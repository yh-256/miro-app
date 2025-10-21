import { NextRequest, NextResponse } from 'next/server';
import { 
  searchBoardItems, 
  searchBySubjectId, 
  searchByUploaderName,
  SearchCriteria,
  SearchResult
} from '@/utils/searchService';
import { ErrorHandler, logError } from '@/utils/errorHandler';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { ensureAuthenticatedSession } from '@/lib/session';
import { getAccessibleProblemIds } from '@/utils/problemProgress';

interface SearchRequestQuery {
  boardId: string;
  query?: string;
  subjectId?: string;
  subjectName?: string;
  uploaderName?: string;
  dateFrom?: string;
  dateTo?: string;
  itemTypes?: string;
  limit?: string;
  searchType?: 'general' | 'subject' | 'uploader';
}

/**
 * GET /api/search - ボード内アイテムの検索
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // クエリパラメータの取得
    const params: SearchRequestQuery = {
      boardId: searchParams.get('boardId') || '',
      query: searchParams.get('query') || undefined,
      subjectId: searchParams.get('subjectId') || undefined,
      // 互換性のために subjectName をオプション受け取り
      subjectName: searchParams.get('subjectName') || undefined,
      uploaderName: searchParams.get('uploaderName') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      itemTypes: searchParams.get('itemTypes') || '',
      limit: searchParams.get('limit') || '50',
      searchType: (searchParams.get('searchType') as 'general' | 'subject' | 'uploader') || 'general',
    };

    // 基本バリデーション
    if (!params.boardId) {
      return NextResponse.json(
        {
          error: 'INVALID_REQUEST',
          message: 'ボードIDが指定されていません。',
          success: false,
          results: { items: [], totalCount: 0, hasMore: false }
        },
        { status: 400 }
      );
    }

    // 検索条件が何も指定されていない場合（ただし日付・タイプ指定がある場合はOK）
    const hasDate = !!(params.dateFrom || params.dateTo);
    const hasTypes = !!(params.itemTypes && params.itemTypes.trim().length > 0);
    if (!params.query && !params.subjectId && !params.uploaderName && !hasDate && !hasTypes) {
      return NextResponse.json(
        {
          error: 'NO_SEARCH_CRITERIA',
          message: '検索条件を指定してください。',
          success: false,
          results: { items: [], totalCount: 0, hasMore: false }
        },
        { status: 400 }
      );
    }

    const limit = parseInt(params.limit || '200') || 200;
    const { ironSession: _ironSession, userSession } = await ensureAuthenticatedSession();
    const accessibleProblemIds = await getAccessibleProblemIds(userSession.id);

    const limitExceededResponse = {
      success: true,
      results: { items: [], totalCount: 0, hasMore: false },
      searchCriteria: {
        boardId: params.boardId,
        query: params.query,
        subjectId: params.subjectId,
        uploaderName: params.uploaderName,
        searchType: params.searchType,
      },
      restrictedCount: 0,
    };

    if (accessibleProblemIds.size === 0) {
      return NextResponse.json(limitExceededResponse);
    }
    let searchResults: SearchResult;

    // 検索タイプに応じた検索実行
    switch (params.searchType) {
      case 'subject':
        if (!params.subjectId) {
          return NextResponse.json(
            {
              error: 'MISSING_SUBJECT_ID',
              message: '個人IDが指定されていません。',
              success: false,
              results: { items: [], totalCount: 0, hasMore: false }
            },
            { status: 400 }
          );
        }
        // 互換性：subjectName があれば併用
        searchResults = await searchBySubjectId(params.boardId, params.subjectId, undefined, params.subjectName);
        break;

      case 'uploader':
        if (!params.uploaderName) {
          return NextResponse.json(
            {
              error: 'MISSING_UPLOADER_NAME',
              message: 'アップロード者名が指定されていません。',
              success: false,
              results: { items: [], totalCount: 0, hasMore: false }
            },
            { status: 400 }
          );
        }
        searchResults = await searchByUploaderName(params.boardId, params.uploaderName);
        break;

      case 'general':
      default:
        // 包括的検索条件の構築
        const criteria: SearchCriteria = {
          query: params.query,
          subjectId: params.subjectId,
          subjectName: params.subjectName,
          uploaderName: params.uploaderName,
        };

        // 日付範囲の処理
        if (params.dateFrom) {
          try {
            criteria.dateFrom = new Date(params.dateFrom);
          } catch (error) {
            logError(error as Error, 'Invalid dateFrom parameter');
          }
        }

        if (params.dateTo) {
          try {
            criteria.dateTo = new Date(params.dateTo);
          } catch (error) {
            logError(error as Error, 'Invalid dateTo parameter');
          }
        }

        // アイテムタイプの処理
        if (params.itemTypes) {
          criteria.itemTypes = params.itemTypes.split(',').map(type => type.trim());
        }

        searchResults = await searchBoardItems(params.boardId, criteria, limit);
        break;
    }

    // 成功レスポンス
    const enrichedResults = await enrichSearchResultsWithDatabase(
      searchResults,
      accessibleProblemIds
    );
    const { results: filteredResults, restrictedCount } =
      filterSearchResultsByAccess(enrichedResults, accessibleProblemIds);

    return NextResponse.json({
      success: true,
      results: filteredResults,
      searchCriteria: {
        boardId: params.boardId,
        query: params.query,
        subjectId: params.subjectId,
        uploaderName: params.uploaderName,
        searchType: params.searchType,
      },
      restrictedCount,
    });

  } catch (error) {
    logError(error as Error, 'GET /api/search');

    const userError = ErrorHandler.handleGenericError(error);

    return NextResponse.json(
      {
        error: 'SEARCH_FAILED',
        message: userError.message,
        success: false,
        results: { items: [], totalCount: 0, hasMore: false }
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/search - 複雑な検索条件での検索
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { boardId, criteria, limit = 50 } = body;

    // 基本バリデーション
    if (!boardId) {
      return NextResponse.json(
        {
          error: 'INVALID_REQUEST',
          message: 'ボードIDが指定されていません。',
          success: false,
          results: { items: [], totalCount: 0, hasMore: false }
        },
        { status: 400 }
      );
    }

    if (!criteria || Object.keys(criteria).length === 0) {
      return NextResponse.json(
        {
          error: 'NO_SEARCH_CRITERIA',
          message: '検索条件を指定してください。',
          success: false,
          results: { items: [], totalCount: 0, hasMore: false }
        },
        { status: 400 }
      );
    }

    // 日付文字列をDateオブジェクトに変換
    const searchCriteria: SearchCriteria = { ...criteria };
    if (criteria.dateFrom) {
      searchCriteria.dateFrom = new Date(criteria.dateFrom);
    }
    if (criteria.dateTo) {
      searchCriteria.dateTo = new Date(criteria.dateTo);
    }

    // 検索実行
    const { ironSession: _ironSession2, userSession: userSession2 } = await ensureAuthenticatedSession();
    const accessibleProblemIds = await getAccessibleProblemIds(userSession2.id);

    if (accessibleProblemIds.size === 0) {
      return NextResponse.json({
        success: true,
        results: { items: [], totalCount: 0, hasMore: false },
        searchCriteria: {
          boardId,
          ...searchCriteria,
        },
      });
    }

    const searchResults = await searchBoardItems(boardId, searchCriteria, limit);
    const enrichedResults = await enrichSearchResultsWithDatabase(
      searchResults,
      accessibleProblemIds
    );
    const { results: filteredResults, restrictedCount } =
      filterSearchResultsByAccess(enrichedResults, accessibleProblemIds);

    return NextResponse.json({
      success: true,
      results: filteredResults,
      searchCriteria: {
        boardId,
        ...searchCriteria,
      },
      restrictedCount,
    });

  } catch (error) {
    logError(error as Error, 'POST /api/search');

    const userError = ErrorHandler.handleGenericError(error);

    return NextResponse.json(
      {
        error: 'SEARCH_FAILED',
        message: userError.message,
        success: false,
        results: { items: [], totalCount: 0, hasMore: false }
      },
      { status: 500 }
    );
  }
}

async function enrichSearchResultsWithDatabase(
  results: SearchResult,
  accessibleProblemIds?: Set<string>
): Promise<SearchResult> {
  if (results.items.length === 0) {
    return results;
  }

  const imageIds = results.items.filter(item => item.type === 'image').map(item => item.id);
  const stickyIds = results.items.filter(item => item.type === 'sticky_note').map(item => item.id);
  const groupIds = results.items.filter(item => item.type === 'group').map(item => item.id);

  const conditions: Prisma.UploadedItemWhereInput[] = [];
  if (imageIds.length > 0) {
    conditions.push({ miroImageId: { in: imageIds } });
  }
  if (stickyIds.length > 0) {
    conditions.push({ miroStickyId: { in: stickyIds } });
  }
  if (groupIds.length > 0) {
    conditions.push({ miroGroupId: { in: groupIds } });
  }

  if (conditions.length === 0) {
    return results;
  }

  const uploadedItems = await prisma.uploadedItem.findMany({
    where: {
      OR: conditions,
      ...(accessibleProblemIds && accessibleProblemIds.size > 0
        ? { problemId: { in: Array.from(accessibleProblemIds) } }
        : {}),
    },
    include: {
      subject: true,
      session: true,
    },
  });

  const mapByImageId = new Map<string, typeof uploadedItems[number]>();
  const mapByStickyId = new Map<string, typeof uploadedItems[number]>();
  const mapByGroupId = new Map<string, typeof uploadedItems[number]>();

  for (const item of uploadedItems) {
    if (item.miroImageId) {
      mapByImageId.set(item.miroImageId, item);
    }
    if (item.miroStickyId) {
      mapByStickyId.set(item.miroStickyId, item);
    }
    if (item.miroGroupId) {
      mapByGroupId.set(item.miroGroupId, item);
    }
  }

  const enrichedItems = results.items.map(resultItem => {
    let dbRecord:
      | typeof uploadedItems[number]
      | undefined = undefined;

    if (resultItem.type === 'image') {
      dbRecord = mapByImageId.get(resultItem.id);
    } else if (resultItem.type === 'sticky_note') {
      dbRecord =
        mapByStickyId.get(resultItem.id) ??
        (resultItem.groupedItems
          ? resultItem.groupedItems
              .map(id => mapByImageId.get(id) ?? mapByStickyId.get(id))
              .find(Boolean)
          : undefined);
    } else if (resultItem.type === 'group') {
      dbRecord =
        mapByGroupId.get(resultItem.id) ??
        (resultItem.groupedItems
          ? resultItem.groupedItems
              .map(id => mapByImageId.get(id) ?? mapByStickyId.get(id))
              .find(Boolean)
          : undefined);
    }

    if (!dbRecord) {
      return resultItem;
    }

    const mergedMetadata = {
      ...(resultItem.metadata ?? {}),
      subjectId: dbRecord.subjectId ?? resultItem.metadata?.subjectId,
      subjectName: dbRecord.subject?.name ?? resultItem.metadata?.subjectName,
      uploaderName: dbRecord.session?.uploaderName ?? resultItem.metadata?.uploaderName,
      uploadedAt: dbRecord.session?.createdAt ?? resultItem.metadata?.uploadedAt,
      fileName: dbRecord.fileName ?? resultItem.metadata?.fileName,
      sessionId: dbRecord.session?.sessionId ?? resultItem.metadata?.sessionId,
      fileSize: dbRecord.fileSize ?? resultItem.metadata?.fileSize,
      mimeType: dbRecord.mimeType ?? resultItem.metadata?.mimeType,
      problemId: dbRecord.problemId ?? resultItem.metadata?.problemId,
      userSessionId: dbRecord.userSessionId ?? resultItem.metadata?.userSessionId,
    };

    return {
      ...resultItem,
      metadata: mergedMetadata,
    };
  });

  return {
    ...results,
    items: enrichedItems,
  };
}

function filterSearchResultsByAccess(
  results: SearchResult,
  accessibleProblemIds: Set<string>
): { results: SearchResult; restrictedCount: number } {
  if (results.items.length === 0) {
    return { results, restrictedCount: 0 };
  }

  const filteredItems = results.items.filter((item) => {
    const problemId = item.metadata?.problemId;
    if (!problemId) {
      return false;
    }
    return accessibleProblemIds.has(problemId);
  });

  const restrictedCount = results.items.length - filteredItems.length;

  return {
    results: {
      ...results,
      items: filteredItems,
      totalCount: filteredItems.length,
      hasMore:
        filteredItems.length === results.items.length ? results.hasMore : false,
    },
    restrictedCount,
  };
}

/**
 * OPTIONS /api/search - CORS プリフライトリクエスト対応
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Next.js App Router用の設定
export const runtime = 'nodejs';
export const maxDuration = 30; // 30秒のタイムアウト
