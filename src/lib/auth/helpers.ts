/**
 * 認証ヘルパー関数
 */

import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./iron-session";
import { IronSessionData } from "./session.types";

/**
 * 現在の認証セッションを取得
 */
export async function getAuthSession(): Promise<IronSessionData> {
  const session = await getSession();
  return {
    userId: session.loginUserId ?? session.userId,
    userDbId: session.userId,
    displayName: session.displayName,
    role: session.role,
    isLoggedIn: session.isLoggedIn ?? false,
    sessionToken: session.sessionToken,
  };
}

/**
 * 認証が必要なページで使用
 * 未ログインの場合は /login にリダイレクト
 */
export async function requireAuth(): Promise<IronSessionData> {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    redirect("/login");
  }
  return session;
}

/**
 * 管理者権限が必要な操作で使用
 * 管理者でない場合はエラーをスロー
 */
export async function requireAdmin(): Promise<IronSessionData> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    throw new Error("管理者権限が必要です");
  }
  return session;
}

/**
 * オプショナルな認証情報を取得
 * ログインしていない場合は null を返す
 */
export async function getOptionalAuth(): Promise<IronSessionData | null> {
  const session = await getAuthSession();
  return session.isLoggedIn ? session : null;
}
