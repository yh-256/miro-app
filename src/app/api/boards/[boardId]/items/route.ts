import { NextRequest, NextResponse } from 'next/server';
import { miroClient } from '@/utils/miroClient';
import { ErrorHandler, logError } from '@/utils/errorHandler';

/**
 * GET /api/boards/[boardId]/items - ボード内アイテム取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('query') || undefined;
    const type = searchParams.get('type') || undefined;

    // ボードIDの検証
    if (!boardId) {
      return NextResponse.json(
        { error: 'INVALID_BOARD_ID', message: 'ボードIDが指定されていません。' },
        { status: 400 }
      );
    }

    // Miro APIからアイテムを検索
    const items = await miroClient.searchItems(boardId, query, type);

    return NextResponse.json({
      success: true,
      boardId,
      items,
      totalCount: items.length,
    });

  } catch (error) {
    logError(error as Error, `GET /api/boards/[boardId]/items`);

    const userError = ErrorHandler.handleMiroApiError(error);
    
    return NextResponse.json(
      { 
        error: 'ITEMS_FETCH_FAILED',
        message: userError.message,
        items: [] 
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/boards/[boardId]/items - CORS プリフライトリクエスト対応
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}