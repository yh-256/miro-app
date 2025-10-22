import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureAuthenticatedSession } from '@/lib/session';
import { UserListResponse } from '@/types';
import { ErrorHandler, logError } from '@/utils/errorHandler';

export async function GET() {
  try {
    const { ironSession } = await ensureAuthenticatedSession();
    if (!ironSession.isLoggedIn || !ironSession.userId) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'ログインが必要です。' },
        { status: 401 }
      );
    }

    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { userId: 'asc' },
      select: {
        id: true,
        userId: true,
        displayName: true,
        isActive: true,
      },
    });

    const response: UserListResponse = {
      users: users.map((user) => ({
        id: user.id,
        userId: user.userId,
        displayName: user.displayName ?? undefined,
        isActive: user.isActive ?? undefined,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    logError(error as Error, 'GET /api/users/list');
    const userError = ErrorHandler.handleGenericError(error);
    return NextResponse.json(
      { error: 'USER_LIST_FAILED', message: userError.message },
      { status: 500 }
    );
  }
}
