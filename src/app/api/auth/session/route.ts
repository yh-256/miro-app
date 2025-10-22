/**
 * GET /api/auth/session - 現在のセッション情報を取得
 */

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/helpers';
import { logError } from '@/utils/errorHandler';

interface SessionResponse {
  isLoggedIn: boolean;
  user: {
    userId?: string;
    dbId?: string;
    displayName?: string;
    role?: string;
  } | null;
}

export async function GET() {
  try {
    const session = await getAuthSession();

    return NextResponse.json({
      isLoggedIn: session.isLoggedIn,
      user: session.isLoggedIn
        ? {
            userId: session.userId,
            dbId: session.userDbId,
            displayName: session.displayName,
            role: session.role,
          }
        : null,
    } as SessionResponse);
  } catch (error) {
    logError(error as Error, 'GET /api/auth/session');
    return NextResponse.json(
      {
        isLoggedIn: false,
        user: null,
      } as SessionResponse,
      { status: 200 }
    );
  }
}
