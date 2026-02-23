/**
 * POST /api/auth/logout - ユーザーログアウト
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/iron-session";
import { logError } from "@/utils/errorHandler";

interface LogoutResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export async function POST() {
  try {
    const session = await getSession();
    session.destroy();

    return NextResponse.json({
      success: true,
    } as LogoutResponse);
  } catch (error) {
    logError(error as Error, "POST /api/auth/logout");
    return NextResponse.json(
      {
        success: false,
        error: "LOGOUT_FAILED",
        message: "ログアウトに失敗しました。",
      } as LogoutResponse,
      { status: 500 },
    );
  }
}
