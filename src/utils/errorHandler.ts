import { UserFriendlyError } from "@/types";

/**
 * エラーの分類と処理
 */
export class ErrorHandler {
  /**
   * Miro APIエラーをユーザーフレンドリーなエラーに変換
   */
  static handleMiroApiError(error: unknown): UserFriendlyError {
    console.error("Miro API Error:", error);

    if (error && typeof error === "object" && "response" in error) {
      const response = (
        error as {
          response: {
            status: number;
            data: unknown;
            headers?: Record<string, string>;
          };
        }
      ).response;
      const status = response.status;
      const data = response.data;
      const errorCode =
        data && typeof data === "object" && "code" in data
          ? (data as { code: string }).code
          : undefined;
      const errorMessage =
        data && typeof data === "object" && "message" in data
          ? (data as { message: string }).message
          : undefined;

      switch (status) {
        case 400:
          if (errorCode === "invalid_board_id") {
            return new UserFriendlyError(
              "無効なボードIDです。正しいボードを選択してください。",
            );
          }
          if (errorCode === "invalid_item_id") {
            return new UserFriendlyError(
              "指定されたアイテムが見つかりません。",
            );
          }
          if (errorCode === "invalid_file_format") {
            return new UserFriendlyError(
              "サポートされていないファイル形式です。JPEG、PNG、GIFファイルを選択してください。",
            );
          }
          if (errorMessage?.includes("geometry")) {
            return new UserFriendlyError(
              "画像のサイズまたは位置情報が無効です。",
            );
          }
          return new UserFriendlyError(
            "リクエストの内容に問題があります。入力内容を確認してください。",
          );

        case 401:
          if (errorCode === "invalid_token") {
            return new UserFriendlyError(
              "認証トークンが無効です。管理者にお問い合わせください。",
            );
          }
          if (errorCode === "token_expired") {
            return new UserFriendlyError(
              "認証トークンの期限が切れています。管理者にお問い合わせください。",
            );
          }
          return new UserFriendlyError(
            "認証に失敗しました。管理者にお問い合わせください。",
          );

        case 403:
          if (errorCode === "board_access_denied") {
            return new UserFriendlyError(
              "このボードにアクセスする権限がありません。ボードの共有設定を確認してください。",
            );
          }
          if (errorCode === "insufficient_permissions") {
            return new UserFriendlyError(
              "この操作を実行する権限がありません。",
            );
          }
          return new UserFriendlyError(
            "このボードにアクセスする権限がありません。",
          );

        case 404:
          if (errorCode === "board_not_found") {
            return new UserFriendlyError(
              "指定されたボードが見つかりません。ボードが削除されているか、URLを確認してください。",
            );
          }
          if (errorCode === "item_not_found") {
            return new UserFriendlyError(
              "指定されたアイテムが見つかりません。すでに削除されている可能性があります。",
            );
          }
          return new UserFriendlyError("指定されたリソースが見つかりません。");

        case 409:
          if (errorCode === "board_locked") {
            return new UserFriendlyError(
              "ボードがロックされています。しばらく待ってから再試行してください。",
            );
          }
          if (errorCode === "item_conflict") {
            return new UserFriendlyError(
              "アイテムの操作で競合が発生しました。画面を更新してから再試行してください。",
            );
          }
          return new UserFriendlyError(
            "操作で競合が発生しました。再試行してください。",
          );

        case 413:
          return new UserFriendlyError(
            "ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。",
          );

        case 415:
          return new UserFriendlyError(
            "サポートされていないファイル形式です。JPEG、PNG、GIFファイルを選択してください。",
          );

        case 429:
          const retryAfter = response.headers?.["retry-after"];
          const waitTime = retryAfter
            ? `${retryAfter}秒後に`
            : "しばらく待ってから";
          return new UserFriendlyError(
            `API呼び出し制限に達しました。${waitTime}再試行してください。`,
          );

        case 500:
        case 502:
        case 503:
        case 504:
          return new UserFriendlyError(
            "Miroサービスに一時的な問題が発生しています。しばらく待ってから再試行してください。",
          );

        default:
          return new UserFriendlyError(
            `Miro APIエラーが発生しました（ステータス: ${status}）。問題が続く場合は管理者にお問い合わせください。`,
          );
      }
    }

    // ネットワークエラー
    if (error && typeof error === "object" && "code" in error) {
      const errorCode = (error as { code: string }).code;
      if (errorCode === "ECONNREFUSED" || errorCode === "ENOTFOUND") {
        return new UserFriendlyError(
          "ネットワーク接続に問題があります。インターネット接続を確認してください。",
        );
      }

      if (errorCode === "ETIMEDOUT") {
        return new UserFriendlyError(
          "処理がタイムアウトしました。ファイルサイズが大きいか、ネットワークが不安定な可能性があります。",
        );
      }

      if (errorCode === "ECONNABORTED") {
        return new UserFriendlyError(
          "リクエストがキャンセルされました。再試行してください。",
        );
      }
    }

    // Fetch API エラー
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      "message" in error
    ) {
      const err = error as { name: string; message: string };
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        return new UserFriendlyError(
          "ネットワーク接続に問題があります。インターネット接続を確認してください。",
        );
      }
    }

    return new UserFriendlyError(
      "予期しないエラーが発生しました。問題が続く場合は管理者にお問い合わせください。",
    );
  }

  /**
   * ファイルアップロードエラーの処理
   */
  static handleFileUploadError(error: unknown): UserFriendlyError {
    console.error("File Upload Error:", error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "LIMIT_FILE_SIZE"
    ) {
      return new UserFriendlyError(
        "ファイルサイズが制限を超えています。10MB以下のファイルを選択してください。",
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "LIMIT_FILE_COUNT"
    ) {
      return new UserFriendlyError(
        "アップロードできるファイル数の上限を超えています。",
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "LIMIT_UNEXPECTED_FILE"
    ) {
      return new UserFriendlyError("予期しないファイルが含まれています。");
    }

    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      (error as { message: string }).message.includes("Invalid file type")
    ) {
      return new UserFriendlyError(
        "サポートされていないファイル形式です。JPEG、PNG、GIFファイルを選択してください。",
      );
    }

    return new UserFriendlyError("ファイルのアップロードに失敗しました。");
  }

  /**
   * バリデーションエラーの処理
   */
  static handleValidationError(error: unknown): UserFriendlyError {
    console.error("Validation Error:", error);

    if (
      error &&
      typeof error === "object" &&
      "errors" in error &&
      Array.isArray((error as { errors: unknown }).errors)
    ) {
      const messages = (error as { errors: Array<{ message?: string }> }).errors
        .map((err: { message?: string }) => err.message || err)
        .join("、");
      return new UserFriendlyError(`入力内容に問題があります: ${messages}`);
    }

    if (error && typeof error === "object" && "message" in error) {
      return new UserFriendlyError((error as { message: string }).message);
    }

    return new UserFriendlyError("入力内容を確認してください。");
  }

  /**
   * 一般的なエラーの処理
   */
  static handleGenericError(error: unknown): UserFriendlyError {
    console.error("Generic Error:", error);

    if (error instanceof UserFriendlyError) {
      return error;
    }

    if (error && typeof error === "object" && "message" in error) {
      // 開発環境では詳細なエラーメッセージを表示
      if (process.env.NODE_ENV === "development") {
        return new UserFriendlyError(
          `エラー: ${(error as { message: string }).message}`,
        );
      }
    }

    return new UserFriendlyError(
      "予期しないエラーが発生しました。しばらく待ってから再試行してください。",
    );
  }
}

/**
 * APIレスポンスのエラーチェック
 */
export function isApiError(
  response: unknown,
): response is { error: string; message?: string } {
  return (
    response !== null &&
    typeof response === "object" &&
    "error" in response &&
    typeof (response as { error: unknown }).error === "string"
  );
}

/**
 * エラーログの記録
 */
export function logError(error: Error, context?: string): void {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` [${context}]` : "";

  console.error(`${timestamp}${contextStr}:`, {
    message: error.message,
    stack: error.stack,
    name: error.name,
  });

  // 本番環境では外部ログサービス（Sentry等）に送信
  if (process.env.NODE_ENV === "production") {
    // TODO: 外部ログサービスへの送信処理
  }
}

/**
 * 非同期処理のエラートラップ
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  _fallback?: T,
): Promise<
  { success: true; data: T } | { success: false; error: UserFriendlyError }
> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const userError = ErrorHandler.handleGenericError(error);
    logError(error as Error, "safeAsync");
    return { success: false, error: userError };
  }
}
