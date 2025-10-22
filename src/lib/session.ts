import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from './prisma';
import { getSession as getIronSession } from './auth/iron-session';

export interface SessionInfo {
  sessionId: string;
  isNew: boolean;
}

export interface AuthenticatedSessionInfo {
  ironSession: {
    userId?: string;
    loginId?: string;
    displayName?: string;
    role?: 'ADMIN' | 'USER';
    isLoggedIn: boolean;
  };
  userSession: {
    id: string;
    sessionToken: string;
    userId?: string | null;
    displayName?: string | null;
  };
}

const SESSION_COOKIE_NAME = 'app_session';
const SESSION_TTL_DAYS = 30;

function generateSessionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function getExpiryDate(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_TTL_DAYS);
  return expiry;
}

export async function ensureSession(): Promise<SessionInfo> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (existing) {
    // extend cookie lifetime on each access
    cookieStore.set({
      name: SESSION_COOKIE_NAME,
      value: existing,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: getExpiryDate(),
    });

    return { sessionId: existing, isNew: false };
  }

  const sessionId = generateSessionId();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: getExpiryDate(),
  });

  return { sessionId, isNew: true };
}

/**
 * ユーザーセッション（DB）とCookieセッションIDを同期
 * - 存在する場合は lastActiveAt を更新
 * - 未作成の場合は新規作成
 */
export async function ensureUserSessionRecord(sessionId: string) {
  return prisma.userSession.upsert({
    where: { sessionToken: sessionId },
    update: {
      lastActiveAt: new Date(),
    },
    create: {
      sessionToken: sessionId,
    },
  });
}

/**
 * 認証ユーザーとUserSessionを統合
 * iron-sessionで認証済みの場合、UserSession.userIdを更新
 */
export async function ensureAuthenticatedSession(): Promise<AuthenticatedSessionInfo> {
  const ironSession = await getIronSession();
  
  // 匿名セッションを確保
  const { sessionId } = await ensureSession();
  let userSession = await ensureUserSessionRecord(sessionId);

  if (ironSession.isLoggedIn && ironSession.userId && !userSession.userId) {
    userSession = await prisma.userSession.update({
      where: { id: userSession.id },
      data: {
        userId: ironSession.userId,
        displayName: ironSession.displayName,
      },
    });
  }

  let loginId = ironSession.loginUserId;

  if (ironSession.isLoggedIn && ironSession.userId && !loginId) {
    const userRecord = await prisma.user.findUnique({
      where: { id: ironSession.userId },
      select: { userId: true, displayName: true },
    });

    if (userRecord) {
      loginId = userRecord.userId;
      if (!ironSession.displayName) {
        ironSession.displayName = userRecord.displayName ?? userRecord.userId;
      }
      ironSession.loginUserId = userRecord.userId;
      await ironSession.save();
    }
  }

  const displayName =
    ironSession.displayName ??
    userSession.displayName ??
    loginId;

  return {
    ironSession: {
      userId: ironSession.userId,
      loginId,
      displayName,
      role: ironSession.role,
      isLoggedIn: ironSession.isLoggedIn ?? false,
    },
    userSession: {
      id: userSession.id,
      sessionToken: userSession.sessionToken,
      userId: userSession.userId,
      displayName: userSession.displayName,
    },
  };
}
