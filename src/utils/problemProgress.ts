import {
  PROBLEM_STATUS_ORDER,
  ProblemProgressStatus,
  BOARD_UNLOCKED_STATUSES,
  isStatusAtLeast,
} from '@/constants/problemStatus';
import { ProblemProgressSnapshot } from '@/types';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export function deriveStatus(
  progressStatus: ProblemProgressStatus | null
): ProblemProgressStatus {
  if (!progressStatus || progressStatus === 'LOCKED') {
    return 'AVAILABLE';
  }
  return progressStatus;
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

type ProblemWithProgress = Prisma.ProblemGetPayload<{
  include: {
    progress: {
      where: {
        userId: string;
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
  isUploadUnlocked: boolean;
  isBoardUnlocked: boolean;
}

export async function loadProblemAccessContext(
  problemId: string,
  userId: string
): Promise<ProblemAccessContext | null> {
  const problem = (await prisma.problem.findUnique({
    where: { id: problemId },
    include: {
      progress: {
        where: { userId },
        take: 1,
      },
    },
  })) as ProblemWithProgress | null;

  if (!problem) {
    return null;
  }

  const progress = problem.progress[0] ?? null;
  const status = deriveStatus(progress?.status ?? null);

  return {
    problem,
    progress,
    status,
    snapshot: toSnapshot(status, progress ?? undefined),
    isUploadUnlocked: isStatusAtLeast(status, 'AVAILABLE'),
    isBoardUnlocked:
      BOARD_UNLOCKED_STATUSES.has(status) || !!progress?.boardUnlockedAt,
  };
}

export async function getAccessibleProblemIds(
  userId: string
): Promise<Set<string>> {
  const rows = await prisma.problemProgress.findMany({
    where: {
      userId,
      status: {
        in: Array.from(BOARD_UNLOCKED_STATUSES),
      },
    },
    select: {
      problemId: true,
    },
  });

  return new Set(rows.map((row) => row.problemId));
}
