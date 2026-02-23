import { NextRequest, NextResponse } from "next/server";
import { miroClient } from "@/utils/miroClient";
import { ErrorHandler, logError } from "@/utils/errorHandler";
import { BoardListResponse } from "@/types";

/**
 * GET /api/boards/list - Miroボード一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "40", 10);

    // Miro APIからボード一覧を取得
    const boards = await miroClient.getBoards(limit);

    // レスポンス形式に変換
    const response: BoardListResponse = {
      boards: boards.map((board) => ({
        id: board.id,
        name: board.name || "Untitled Board",
        description: board.description || "",
        thumbnailUrl: board.picture?.imageUrl || undefined,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    logError(error as Error, "GET /api/boards/list");

    // エラーハンドリング
    const userError = ErrorHandler.handleMiroApiError(error);

    return NextResponse.json(
      {
        error: "BOARDS_FETCH_FAILED",
        message: userError.message,
        boards: [],
      },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS /api/boards/list - CORS プリフライトリクエスト対応
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
