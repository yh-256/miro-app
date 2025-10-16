import { NextRequest, NextResponse } from 'next/server';
import { SubjectListResponse } from '@/types';
import { logError } from '@/utils/errorHandler';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/subjects/list - 個人ID一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';

    const subjects = await prisma.subject.findMany({
      where: query
        ? {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          }
        : undefined,
      orderBy: [
        {
          lastUsedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    // レスポンス形式に変換
    const response: SubjectListResponse = {
      subjects: subjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        createdAt: subject.createdAt.toISOString(),
        lastUsedAt: subject.lastUsedAt?.toISOString(),
      })),
    };

    return NextResponse.json(response);

  } catch (error) {
    logError(error as Error, 'GET /api/subjects/list');

    return NextResponse.json(
      { 
        error: 'SUBJECTS_FETCH_FAILED',
        message: '個人ID一覧の取得に失敗しました。',
        subjects: [] 
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/subjects/list - CORS プリフライトリクエスト対応
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
