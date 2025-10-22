import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureAuthenticatedSession } from '@/lib/session';
import { ProblemListResponse } from '@/types';
import { ErrorHandler, logError } from '@/utils/errorHandler';
import { deriveStatus, toSnapshot } from '@/utils/problemProgress';
import { COMPLETED_STATUSES } from '@/constants/problemStatus';

export async function GET() {
  try {
    const { ironSession } = await ensureAuthenticatedSession();
    if (!ironSession.isLoggedIn || !ironSession.userId) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'ログインが必要です。' },
        { status: 401 }
      );
    }

    const problems = await prisma.problem.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
      include: {
        progress: {
          where: { userId: ironSession.userId },
          take: 1,
        },
      },
    });

    if (problems.length === 0) {
      const emptyResponse: ProblemListResponse = {
        problems: [],
        stats: { total: 0, completed: 0, available: 0 },
      };
      return NextResponse.json(emptyResponse);
    }

    const summaries = problems.map((problem) => {
      const progress = problem.progress[0];
      const baseStatus = progress?.status ?? null;
      const status = deriveStatus(baseStatus);
      const snapshot = toSnapshot(status, progress);

      return {
        id: problem.id,
        title: problem.title,
        description: problem.description ?? undefined,
        orderIndex: problem.orderIndex,
        isActive: problem.isActive,
        ...snapshot,
      };
    });

    let activeProblemId: string | undefined;
    for (const summary of summaries) {
      if (!COMPLETED_STATUSES.has(summary.status)) {
        activeProblemId = summary.id;
        break;
      }
    }

    const nextProblemId = activeProblemId
      ? (() => {
          const currentIndex = summaries.findIndex(
            (p) => p.id === activeProblemId
          );
          return currentIndex >= 0 && currentIndex + 1 < summaries.length
            ? summaries[currentIndex + 1].id
            : undefined;
        })()
      : undefined;

    const stats = summaries.reduce(
      (acc, summary) => {
        acc.total += 1;
        if (summary.status === 'COMPLETED') {
          acc.completed += 1;
        }
        if (summary.status === 'AVAILABLE') {
          acc.available += 1;
        }
        return acc;
      },
      { total: 0, completed: 0, available: 0 }
    );

    const response: ProblemListResponse = {
      problems: summaries,
      activeProblemId,
      nextProblemId,
      stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    logError(error as Error, 'GET /api/problems');
    const userError = ErrorHandler.handleGenericError(error);
    return NextResponse.json(
      { error: 'PROBLEM_LIST_FAILED', message: userError.message },
      { status: 500 }
    );
  }
}
