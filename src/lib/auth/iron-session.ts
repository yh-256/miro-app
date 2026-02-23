/**
 * iron-session のヘルパー関数
 */

import "server-only";
import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { IronSessionData } from "./session.types";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters long");
}

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET,
  cookieName: "auth_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7日
    path: "/",
  },
};

/**
 * iron-session インスタンスを取得
 */
export async function getSession(): Promise<IronSession<IronSessionData>> {
  const cookieStore = await cookies();
  return getIronSession<IronSessionData>(cookieStore, SESSION_OPTIONS);
}
