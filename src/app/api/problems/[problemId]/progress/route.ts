import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureSession, ensureUserSessionRecord } from '@/lib/session';
import { ProblemProgressUpdatePayload } from '@/types';
import { ErrorHandler, logError } from '@/utils/errorHandler';
import {
  loadProblemAccessContext,
  toSnapshot,
  maxStatus,
} from '@/utils/problemProgress';
import {
  isProblemProgressStatus,
  PROBLEM_STATUS_LABEL,
  isStatusAtLeast,
  BOARD_UNLOCKED_STATUSES,
} from '@/constants/problemStatus';

function validatePayload(body: unknown): ProblemProgressUpdatePayload {
  if (!body || typeof body !== 'object') {
    throw new Error('INVALID_BODY');
  }

  const { status, boardViewed, completed } = body as Record<string, unknown>;

  if (
    status === undefined &&
    boardViewed === undefined &&
    completed === undefined
  ) {
    throw new Error('NO_FIELDS');
  }

  let normalizedStatus: ProblemProgressUpdatePayload['status'] | undefined;
  if (status !== undefined) {
    if (typeof status !== 'string' || !isProblemProgressStatus(status)) {
      throw new Error('INVALID_STATUS');
    }
    normalizedStatus = status;
  }

  const payload: ProblemProgressUpdatePayload = {
    boardViewed: boardViewed === true,
    completed: completed === true,
  };

  if (normalizedStatus) {
    payload.status = normalizedStatus;
  }

  return payload;
}

export async function PATCH(
  request: NextRequest,
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

    let payload: ProblemProgressUpdatePayload;
    try {
      payload = validatePayload(await request.json());
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'NO_FIELDS'
          ? '更新対象が指定されていません。'
          : error instanceof Error && error.message === 'INVALID_STATUS'
          ? '指定されたステータス値が不正です。'
          : 'リクエスト形式が不正です。';
      const code =
        error instanceof Error &&
        (error.message === 'NO_FIELDS' || error.message === 'INVALID_STATUS')
          ? 400
          : 400;
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message },
        { status: code }
      );
    }

    const { sessionId } = await ensureSession();
    const userSession = await ensureUserSessionRecord(sessionId);

    const context = await loadProblemAccessContext(problemId, userSession.id);
    if (!context) {
      return NextResponse.json(
        { error: 'PROBLEM_NOT_FOUND', message: '指定された問題が見つかりません。' },
        { status: 404 }
      );
    }

    const { status: currentStatus, progress } = context;

    if (
      (payload.boardViewed || payload.completed) &&
      !BOARD_UNLOCKED_STATUSES.has(currentStatus)
    ) {
      return NextResponse.json(
        {
          error: 'PROGRESS_UPDATE_FORBIDDEN',
          message: 'ボード閲覧前に必要なステップを完了してください。',
        },
        { status: 403 }
      );
    }

    let targetStatus = currentStatus;
    if (payload.status) {
      targetStatus = maxStatus(targetStatus, payload.status);
    }
    if (payload.boardViewed) {
      targetStatus = maxStatus(targetStatus, 'BOARD_VIEWED');
    }
    if (payload.completed) {
      targetStatus = 'COMPLETED';
    }

    const now = new Date();

    const updatedProgress = await prisma.problemProgress.upsert({
      where: {
        problemId_userSessionId: {
          problemId,
          userSessionId: userSession.id,
        },
      },
      update: {
        status: targetStatus,
        boardUnlockedAt:
          isStatusAtLeast(targetStatus, 'INSIGHT_WRITTEN')
            ? progress?.boardUnlockedAt ?? now
            : progress?.boardUnlockedAt ?? null,
        boardViewedAt: payload.boardViewed ? now : progress?.boardViewedAt ?? null,
        completedAt: payload.completed ? now : progress?.completedAt ?? null,
      },
      create: {
        problemId,
        userSessionId: userSession.id,
        status: targetStatus,
        boardUnlockedAt: isStatusAtLeast(targetStatus, 'INSIGHT_WRITTEN')
          ? now
          : null,
        boardViewedAt: payload.boardViewed ? now : null,
        completedAt: payload.completed ? now : null,
      },
    });

    return NextResponse.json({
      progress: toSnapshot(updatedProgress.status, updatedProgress),
      statusLabel: PROBLEM_STATUS_LABEL[updatedProgress.status],
    });
  } catch (error) {
    logError(error as Error, 'PATCH /api/problems/[problemId]/progress');
    const userError = ErrorHandler.handleGenericError(error);
    return NextResponse.json(
      { error: 'PROGRESS_UPDATE_FAILED', message: userError.message },
      { status: 500 }
    );
  }
}
