import { NextRequest, NextResponse } from 'next/server';
import { addSubject, isSubjectNameExists } from '@/utils/subjectStorage';
import { logError } from '@/utils/errorHandler';

interface CreateSubjectRequest {
  name: string;
}

interface CreateSubjectResponse {
  success: boolean;
  subject?: {
    id: string;
    name: string;
    createdAt: string;
  };
  error?: string;
  message?: string;
}

/**
 * POST /api/subjects/create - 新しい個人IDを作成
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateSubjectRequest = await request.json();
    const { name } = body;

    // バリデーション
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'INVALID_NAME',
          message: '個人ID名が指定されていません。' 
        } as CreateSubjectResponse,
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    
    // 名前の長さチェック
    if (trimmedName.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'EMPTY_NAME',
          message: '個人ID名を入力してください。' 
        } as CreateSubjectResponse,
        { status: 400 }
      );
    }

    if (trimmedName.length > 50) {
      return NextResponse.json(
        { 
          success: false,
          error: 'NAME_TOO_LONG',
          message: '個人ID名は50文字以内で入力してください。' 
        } as CreateSubjectResponse,
        { status: 400 }
      );
    }

    // 重複チェック
    if (isSubjectNameExists(trimmedName)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'DUPLICATE_NAME',
          message: 'この個人ID名は既に存在します。' 
        } as CreateSubjectResponse,
        { status: 409 }
      );
    }

    // 個人IDを作成
    const newSubject = addSubject(trimmedName);

    const response: CreateSubjectResponse = {
      success: true,
      subject: {
        id: newSubject.id,
        name: newSubject.name,
        createdAt: newSubject.createdAt.toISOString(),
      },
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    logError(error as Error, 'POST /api/subjects/create');

    return NextResponse.json(
      { 
        success: false,
        error: 'CREATION_FAILED',
        message: '個人IDの作成に失敗しました。' 
      } as CreateSubjectResponse,
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/subjects/create - CORS プリフライトリクエスト対応
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}