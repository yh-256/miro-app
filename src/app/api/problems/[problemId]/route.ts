import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureSession, ensureUserSessionRecord } from '@/lib/session';
import {
  ProblemDetailResponse,
  ProblemProgressSnapshot,
  InsightSummary,
} from '@/types';
import { ProblemProgressStatus } from '@/constants/problemStatus';
import { ErrorHandler, logError } from '@/utils/errorHandler';

const BOARD_UNLOCKED_STATUSES: ReadonlySet<ProblemProgressStatus> = new Set([
  'INSIGHT_WRITTEN',
  'BOARD_VIEWED',
  'COMPLETED',
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
  isFirstAvailable: boolean
): ProblemProgressStatus {
  if (progressStatus) {
    return progressStatus;
  }
  return isFirstAvailable ? 'AVAILABLE' : 'LOCKED';
}

function mapInsightToSummary(insight: {
  id: string;
  problemId: string;
  userSessionId: string;
  content: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  userSession: { sessionToken: string; displayName: string | null };
}): InsightSummary {
  return {
    id: insight.id,
    problemId: insight.problemId,
    sessionId: insight.userSession.sessionToken,
    content: insight.content,
    isPublic: insight.isPublic,
    createdAt: insight.createdAt.toISOString(),
    updatedAt: insight.updatedAt.toISOString(),
    author: {
      sessionId: insight.userSession.sessionToken,
      displayName: insight.userSession.displayName ?? undefined,
    },
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ problemId: string }> }
) {
  try {
    const { problemId } = await params;
    if (!problemId) {
      return NextResponse.json(
        { error: 'INVALID_PROBLEM_ID', message: '問題IDが指定されていません。' },
        { status: 400 }
      );
    }

    const { sessionId } = ensureSession();
    const userSession = await ensureUserSessionRecord(sessionId);

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        progress: {
          where: { userSessionId: userSession.id },
          take: 1,
        },
      },
    });

    if (!problem) {
      return NextResponse.json(
        { error: 'PROBLEM_NOT_FOUND', message: '指定された問題が見つかりません。' },
        { status: 404 }
      );
    }

    // Determine previous problems to decide availability
    const precedingProblems = await prisma.problem.findMany({
      where: {
        isActive: true,
        orderIndex: { lt: problem.orderIndex },
      },
      include: {
        progress: {
          where: { userSessionId: userSession.id },
          take: 1,
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    const allPreviousCompleted = precedingProblems.every((item) => {
      const status = item.progress[0]?.status ?? 'LOCKED';
      return BOARD_UNLOCKED_STATUSES.has(status) || status === 'COMPLETED';
    });

    const progressRecord = problem.progress[0];
    const status = deriveStatus(progressRecord?.status ?? null, allPreviousCompleted);
    const snapshot = toSnapshot(status, progressRecord);
    const isBoardUnlocked =
      BOARD_UNLOCKED_STATUSES.has(status) || !!progressRecord?.boardUnlockedAt;

    const detail = {
      id: problem.id,
      title: problem.title,
      description: problem.description ?? undefined,
      orderIndex: problem.orderIndex,
      isActive: problem.isActive,
      contentType: problem.contentType,
      contentBody: problem.contentBody ?? undefined,
      contentUrl: problem.contentUrl ?? undefined,
      miroBoardId: isBoardUnlocked ? problem.miroBoardId ?? undefined : undefined,
      isBoardUnlocked,
      createdAt: problem.createdAt.toISOString(),
      updatedAt: problem.updatedAt.toISOString(),
      ...snapshot,
    };

    let relatedInsights: InsightSummary[] | undefined;
    if (isBoardUnlocked) {
      const insightRecords = await prisma.insight.findMany({
        where: {
          problemId,
          OR: [
            { isPublic: true },
            { userSessionId: userSession.id },
          ],
        },
        orderBy: { createdAt: 'asc' },
        include: {
          userSession: true,
        },
      });

      relatedInsights = insightRecords.map(mapInsightToSummary);
    }

    const response: ProblemDetailResponse = {
      problem: detail,
      relatedInsights,
    };

    return NextResponse.json(response);
  } catch (error) {
    logError(error as Error, 'GET /api/problems/[problemId]');
    const userError = ErrorHandler.handleGenericError(error);
    return NextResponse.json(
      { error: 'PROBLEM_DETAIL_FAILED', message: userError.message },
      { status: 500 }
    );
  }
}
