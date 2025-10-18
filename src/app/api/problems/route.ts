import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureSession, ensureUserSessionRecord } from '@/lib/session';
import { ProblemListResponse, ProblemProgressSnapshot } from '@/types';
import { ProblemProgressStatus } from '@/constants/problemStatus';
import { ErrorHandler, logError } from '@/utils/errorHandler';

const COMPLETED_STATUSES: ReadonlySet<ProblemProgressStatus> = new Set([
  'COMPLETED',
  'BOARD_VIEWED',
]);

function toSnapshot(
  status: ProblemProgressStatus,
  progress?: {
    insightSubmittedAt: Date | null;
    boardUnlockedAt: Date | null;
    boardViewedAt: Date | null;
    completedAt: Date | null;
  }
): ProblemProgressSnapshot {
  return {
    status,
    insightSubmittedAt: progress?.insightSubmittedAt
      ? progress.insightSubmittedAt.toISOString()
      : undefined,
    boardUnlockedAt: progress?.boardUnlockedAt
      ? progress.boardUnlockedAt.toISOString()
      : undefined,
    boardViewedAt: progress?.boardViewedAt
      ? progress.boardViewedAt.toISOString()
      : undefined,
    completedAt: progress?.completedAt
      ? progress.completedAt.toISOString()
      : undefined,
  };
}

function deriveStatus(
  progressStatus: ProblemProgressStatus | null,
  canUnlock: boolean
): ProblemProgressStatus {
  if (progressStatus) {
    return progressStatus;
  }
  return canUnlock ? 'AVAILABLE' : 'LOCKED';
}

export async function GET() {
  try {
    const { sessionId } = ensureSession();
    const userSession = await ensureUserSessionRecord(sessionId);

    const problems = await prisma.problem.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
      include: {
        progress: {
          where: { userSessionId: userSession.id },
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

    let canUnlockNext = true;
    let activeProblemId: string | undefined;

    const summaries = problems.map((problem) => {
      const progress = problem.progress[0];
      const baseStatus = progress?.status ?? null;
      const status = deriveStatus(baseStatus, canUnlockNext);
      const snapshot = toSnapshot(status, progress);

      if (!activeProblemId && !COMPLETED_STATUSES.has(status)) {
        activeProblemId = problem.id;
      }

      if (!COMPLETED_STATUSES.has(status)) {
        canUnlockNext = false;
      }

      return {
        id: problem.id,
        title: problem.title,
        description: problem.description ?? undefined,
        orderIndex: problem.orderIndex,
        isActive: problem.isActive,
        ...snapshot,
      };
    });

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
