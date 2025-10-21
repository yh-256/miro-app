/**
 * POST /api/admin/users - ユーザー作成（管理者専用）
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/helpers';
import { logError } from '@/utils/errorHandler';

interface CreateUserRequest {
  userId: string;
  pin: string;
  displayName?: string;
  role?: 'ADMIN' | 'USER';
}

interface CreateUserResponse {
  success: boolean;
  user?: {
    id: string;
    userId: string;
    displayName: string | null;
    role: string;
    createdAt: string;
  };
  error?: string;
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 管理者権限チェック
    const adminSession = await requireAdmin();

    const body: CreateUserRequest = await request.json();
    const { userId, pin, displayName, role = 'USER' } = body;

    // バリデーション
    if (!userId || !pin) {
      return NextResponse.json(
        { 
          success: false,
          error: 'INVALID_REQUEST', 
          message: 'ユーザーIDとPINは必須です。' 
        } as CreateUserResponse,
        { status: 400 }
      );
    }

    if (userId.length < 3 || userId.length > 50) {
      return NextResponse.json(
        { 
          success: false,
          error: 'INVALID_USER_ID', 
          message: 'ユーザーIDは3〜50文字で入力してください。' 
        } as CreateUserResponse,
        { status: 400 }
      );
    }

    if (pin.length < 4 || pin.length > 20) {
      return NextResponse.json(
        { 
          success: false,
          error: 'INVALID_PIN', 
          message: 'PINは4〜20文字で入力してください。' 
        } as CreateUserResponse,
        { status: 400 }
      );
    }

    // PINをハッシュ化（salt rounds: 10）
    const pinHash = await bcrypt.hash(pin, 10);

    // ユーザー作成
    const newUser = await prisma.user.create({
      data: {
        userId,
        pinHash,
        displayName,
        role,
        createdBy: adminSession.userId,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        userId: newUser.userId,
        displayName: newUser.displayName,
        role: newUser.role,
        createdAt: newUser.createdAt.toISOString(),
      },
    } as CreateUserResponse, { status: 201 });
  } catch (error) {
    // リダイレクトエラー（未認証）
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }

    // 管理者権限エラー
    if (error instanceof Error && error.message === '管理者権限が必要です') {
      return NextResponse.json(
        { 
          success: false,
          error: 'FORBIDDEN', 
          message: error.message 
        } as CreateUserResponse,
        { status: 403 }
      );
    }

    // ユニーク制約違反（ユーザーIDの重複）
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { 
          success: false,
          error: 'USER_EXISTS', 
          message: 'このユーザーIDは既に使用されています。' 
        } as CreateUserResponse,
        { status: 409 }
      );
    }

    logError(error as Error, 'POST /api/admin/users');
    return NextResponse.json(
      { 
        success: false,
        error: 'CREATE_USER_FAILED', 
        message: 'ユーザーの作成に失敗しました。' 
      } as CreateUserResponse,
      { status: 500 }
    );
  }
}
