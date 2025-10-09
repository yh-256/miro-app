import { NextRequest, NextResponse } from 'next/server';
import { 
  searchBoardItems, 
  searchBySubjectId, 
  searchByUploaderName,
  SearchCriteria,
  SearchResult
} from '@/utils/searchService';
import { ErrorHandler, logError } from '@/utils/errorHandler';

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
    return NextResponse.json({
      success: true,
      results: searchResults,
      searchCriteria: {
        boardId: params.boardId,
        query: params.query,
        subjectId: params.subjectId,
        uploaderName: params.uploaderName,
        searchType: params.searchType,
      },
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
    const searchResults = await searchBoardItems(boardId, searchCriteria, limit);

    return NextResponse.json({
      success: true,
      results: searchResults,
      searchCriteria: {
        boardId,
        ...searchCriteria,
      },
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
