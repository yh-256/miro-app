/**
 * POST /api/auth/login - ユーザーログイン
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/iron-session';
import { logError } from '@/utils/errorHandler';

interface LoginRequest {
  userId: string;
  pin: string;
}

interface LoginResponse {
  success: boolean;
  user?: {
    userId: string;
    displayName: string | null;
    role: string;
  };
  error?: string;
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { userId, pin } = body;

    // バリデーション
    if (!userId || !pin) {
      return NextResponse.json(
        { 
          success: false,
          error: 'INVALID_REQUEST', 
          message: 'ユーザーIDとPINを入力してください。' 
        } as LoginResponse,
        { status: 400 }
      );
    }

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { userId, isActive: true },
    });

    if (!user) {
      // タイミング攻撃対策: ユーザーが存在しない場合もbcryptを実行
      await bcrypt.compare(pin, '$2a$10$invalidHashToPreventTimingAttack');
      return NextResponse.json(
        { 
          success: false,
          error: 'INVALID_CREDENTIALS', 
          message: 'ユーザーIDまたはPINが正しくありません。' 
        } as LoginResponse,
        { status: 401 }
      );
    }

    // PIN検証
    const isValidPin = await bcrypt.compare(pin, user.pinHash);
    if (!isValidPin) {
      return NextResponse.json(
        { 
          success: false,
          error: 'INVALID_CREDENTIALS', 
          message: 'ユーザーIDまたはPINが正しくありません。' 
        } as LoginResponse,
        { status: 401 }
      );
    }

    // iron-sessionに保存
    const session = await getSession();
    session.userId = user.id;
    session.displayName = user.displayName ?? userId;
    session.role = user.role;
    session.isLoggedIn = true;
    await session.save();

    // 最終ログイン日時を更新
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      user: {
        userId: user.userId,
        displayName: user.displayName,
        role: user.role,
      },
    } as LoginResponse);
  } catch (error) {
    logError(error as Error, 'POST /api/auth/login');
    return NextResponse.json(
      { 
        success: false,
        error: 'LOGIN_FAILED', 
        message: 'ログインに失敗しました。' 
      } as LoginResponse,
      { status: 500 }
    );
  }
}
