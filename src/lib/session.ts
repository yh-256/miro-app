import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface SessionInfo {
  sessionId: string;
  isNew: boolean;
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

export function ensureSession(): SessionInfo {
  const cookieStore = cookies();
  const existing = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (existing) {
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
