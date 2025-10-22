/**
 * iron-session の型定義
 */

export interface IronSessionData {
  userId?: string;           // User.id (ログイン中のみ)
  loginUserId?: string;      // ログイン時に入力したユーザーID
  userDbId?: string;         // 互換性のための派生フィールド（getAuthSession専用）
  displayName?: string;      // 表示名
  role?: 'ADMIN' | 'USER';   // 権限
  isLoggedIn: boolean;       // ログイン状態
  sessionToken?: string;     // 既存のapp_session値（統合用）
}

// iron-sessionの型拡張
declare module 'iron-session' {
  interface IronSessionData {
    userId?: string;
    loginUserId?: string;
    userDbId?: string;
    displayName?: string;
    role?: 'ADMIN' | 'USER';
    isLoggedIn: boolean;
    sessionToken?: string;
  }
}
