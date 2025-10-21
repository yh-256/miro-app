import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureAuthenticatedSession } from '@/lib/session';
import { ProblemDetailResponse, InsightSummary } from '@/types';
import { ErrorHandler, logError } from '@/utils/errorHandler';
import { loadProblemAccessContext } from '@/utils/problemProgress';
import { mapInsightToSummary } from '@/utils/insight';

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

    const { ironSession: _ironSession, userSession } = await ensureAuthenticatedSession();

    const context = await loadProblemAccessContext(problemId, userSession.id);

    if (!context) {
      return NextResponse.json(
        { error: 'PROBLEM_NOT_FOUND', message: '指定された問題が見つかりません。' },
        { status: 404 }
      );
    }

    const { problem, snapshot, isBoardUnlocked, isUploadUnlocked } = context;

    const detail = {
      id: problem.id,
      title: problem.title,
      description: problem.description ?? undefined,
      orderIndex: problem.orderIndex,
      isActive: problem.isActive,
      contentType: problem.contentType,
      contentBody: problem.contentBody ?? undefined,
      contentUrl: problem.contentUrl ?? undefined,
      miroBoardId:
        isUploadUnlocked || isBoardUnlocked
          ? problem.miroBoardId ?? undefined
          : undefined,
      isUploadUnlocked,
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
