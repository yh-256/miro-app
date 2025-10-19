import {
  PROBLEM_STATUS_ORDER,
  ProblemProgressStatus,
} from '@/constants/problemStatus';
import { ProblemProgressSnapshot } from '@/types';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const COMPLETED_STATUSES: ReadonlySet<ProblemProgressStatus> = new Set([
  'COMPLETED',
  'BOARD_VIEWED',
]);

export const BOARD_UNLOCKED_STATUSES: ReadonlySet<ProblemProgressStatus> =
  new Set(['INSIGHT_WRITTEN', 'BOARD_VIEWED', 'COMPLETED']);

export function deriveStatus(
  progressStatus: ProblemProgressStatus | null,
  isFirstAvailable: boolean
): ProblemProgressStatus {
  if (progressStatus) {
    return progressStatus;
  }
  return isFirstAvailable ? 'AVAILABLE' : 'LOCKED';
}

export function toSnapshot(
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

export function maxStatus(
  current: ProblemProgressStatus,
  candidate: ProblemProgressStatus
): ProblemProgressStatus {
  return PROBLEM_STATUS_ORDER[current] >= PROBLEM_STATUS_ORDER[candidate]
    ? current
    : candidate;
}

export function isStatusAtLeast(
  value: ProblemProgressStatus,
  threshold: ProblemProgressStatus
): boolean {
  return PROBLEM_STATUS_ORDER[value] >= PROBLEM_STATUS_ORDER[threshold];
}

type ProblemWithProgress = Prisma.ProblemGetPayload<{
  include: {
    progress: {
      where: {
        userSessionId: string;
      };
      take: 1;
    };
  };
}>;

type ProblemProgressRecord =
  ProblemWithProgress['progress'] extends (infer U)[]
    ? U
    : never;

export interface ProblemAccessContext {
  problem: ProblemWithProgress;
  progress: ProblemProgressRecord | null;
  status: ProblemProgressStatus;
  snapshot: ProblemProgressSnapshot;
  isBoardUnlocked: boolean;
  allPreviousCompleted: boolean;
}

export async function loadProblemAccessContext(
  problemId: string,
  userSessionId: string
): Promise<ProblemAccessContext | null> {
  const problem = (await prisma.problem.findUnique({
    where: { id: problemId },
    include: {
      progress: {
        where: { userSessionId },
        take: 1,
      },
    },
  })) as ProblemWithProgress | null;

  if (!problem) {
    return null;
  }

  const progress = problem.progress[0] ?? null;

  const precedingProblems = (await prisma.problem.findMany({
    where: {
      isActive: true,
      orderIndex: { lt: problem.orderIndex },
    },
    include: {
      progress: {
        where: { userSessionId },
        take: 1,
      },
    },
    orderBy: { orderIndex: 'asc' },
  })) as ProblemWithProgress[];

  const allPreviousCompleted = precedingProblems.every((item) => {
    const prevStatus = item.progress[0]?.status ?? 'LOCKED';
    return BOARD_UNLOCKED_STATUSES.has(prevStatus);
  });

  const status = deriveStatus(progress?.status ?? null, allPreviousCompleted);
  const snapshot = toSnapshot(status, progress ?? undefined);
  const isBoardUnlocked =
    BOARD_UNLOCKED_STATUSES.has(status) || !!progress?.boardUnlockedAt;

  return {
    problem,
    progress,
    status,
    snapshot,
    isBoardUnlocked,
    allPreviousCompleted,
  };
}
