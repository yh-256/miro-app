import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from './prisma';

export interface SessionInfo {
  sessionId: string;
  isNew: boolean;
}

export interface SessionContext {
  sessionId: string;
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
 * 匿名セッションを確保し、対応するUserSessionレコードを返す
 */
export async function ensureSessionContext(): Promise<SessionContext> {
  const { sessionId } = await ensureSession();
  const userSession = await ensureUserSessionRecord(sessionId);

  return {
    sessionId,
    userSession: {
      id: userSession.id,
      sessionToken: userSession.sessionToken,
      userId: userSession.userId,
      displayName: userSession.displayName,
    },
  };
}
