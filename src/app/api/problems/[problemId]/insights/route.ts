import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureSession, ensureUserSessionRecord } from '@/lib/session';
import { InsightListResponse, InsightPayload } from '@/types';
import { ErrorHandler, logError } from '@/utils/errorHandler';
import {
  loadProblemAccessContext,
  toSnapshot,
  maxStatus,
} from '@/utils/problemProgress';
import { isStatusAtLeast } from '@/constants/problemStatus';
import { mapInsightToSummary } from '@/utils/insight';

function validatePayload(body: unknown): InsightPayload {
  if (!body || typeof body !== 'object') {
    throw new Error('INVALID_BODY');
  }
  const { content, isPublic } = body as Record<string, unknown>;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('INVALID_CONTENT');
  }

  return {
    content: content.trim(),
    isPublic: typeof isPublic === 'boolean' ? isPublic : true,
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

    const { sessionId } = await ensureSession();
    const userSession = await ensureUserSessionRecord(sessionId);

    const context = await loadProblemAccessContext(problemId, userSession.id);
    if (!context) {
      return NextResponse.json(
        { error: 'PROBLEM_NOT_FOUND', message: '指定された問題が見つかりません。' },
        { status: 404 }
      );
    }

    if (!isStatusAtLeast(context.status, 'INSIGHT_WRITTEN')) {
      return NextResponse.json(
        {
          error: 'INSIGHT_ACCESS_FORBIDDEN',
          message: '気づきを閲覧するには先に投稿を完了してください。',
        },
        { status: 403 }
      );
    }

    const insights = await prisma.insight.findMany({
      where: {
        problemId,
        OR: [{ isPublic: true }, { userSessionId: userSession.id }],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        userSession: true,
      },
    });

    const response: InsightListResponse = {
      insights: insights.map(mapInsightToSummary),
    };

    return NextResponse.json(response);
  } catch (error) {
    logError(error as Error, 'GET /api/problems/[problemId]/insights');
    const userError = ErrorHandler.handleGenericError(error);
    const status = userError.message.includes('閲覧するには')
      ? 403
      : 500;
    return NextResponse.json(
      { error: 'INSIGHT_LIST_FAILED', message: userError.message },
      { status }
    );
  }
}

export async function POST(
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

    const payload = validatePayload(await request.json());

    const { sessionId } = await ensureSession();
    const userSession = await ensureUserSessionRecord(sessionId);

    const context = await loadProblemAccessContext(problemId, userSession.id);
    if (!context) {
      return NextResponse.json(
        { error: 'PROBLEM_NOT_FOUND', message: '指定された問題が見つかりません。' },
        { status: 404 }
      );
    }

    if (!context.allPreviousCompleted && context.status === 'LOCKED') {
      return NextResponse.json(
        {
          error: 'INSIGHT_SUBMIT_FORBIDDEN',
          message: '先行する問題の気づきを完了してください。',
        },
        { status: 403 }
      );
    }

    const now = new Date();
    const currentProgress = context.progress;
    const targetStatus = maxStatus(
      currentProgress?.status ?? 'LOCKED',
      'INSIGHT_WRITTEN'
    );

    const result = await prisma.$transaction(async (tx) => {
      const createdInsight = await tx.insight.create({
        data: {
          problemId,
          userSessionId: userSession.id,
          content: payload.content,
          isPublic: payload.isPublic ?? true,
        },
        include: {
          userSession: true,
        },
      });

      if (currentProgress) {
        await tx.problemProgress.update({
          where: { id: currentProgress.id },
          data: {
            status: targetStatus,
            insightSubmittedAt:
              currentProgress.insightSubmittedAt ?? now,
            boardUnlockedAt: currentProgress.boardUnlockedAt ?? now,
          },
        });
      } else {
        await tx.problemProgress.create({
          data: {
            problemId,
            userSessionId: userSession.id,
            status: targetStatus,
            insightSubmittedAt: now,
            boardUnlockedAt: now,
          },
        });
      }

      return createdInsight;
    });

    const updatedContext = await loadProblemAccessContext(
      problemId,
      userSession.id
    );

    return NextResponse.json({
      insight: mapInsightToSummary(result),
      progress: updatedContext
        ? toSnapshot(updatedContext.status, updatedContext.progress ?? undefined)
        : undefined,
    });
  } catch (error) {
    logError(error as Error, 'POST /api/problems/[problemId]/insights');
    const message =
      error instanceof Error && error.message === 'INVALID_CONTENT'
        ? '気づきの内容を入力してください。'
        : error instanceof Error && error.message === 'INVALID_BODY'
        ? 'リクエスト形式が不正です。'
        : ErrorHandler.handleGenericError(error).message;
    const status =
      error instanceof Error &&
      (error.message === 'INVALID_CONTENT' || error.message === 'INVALID_BODY')
        ? 400
        : 500;

    return NextResponse.json(
      { error: 'INSIGHT_CREATE_FAILED', message },
      { status }
    );
  }
}
