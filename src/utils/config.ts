/**
 * セキュリティ強化された環境変数の管理とバリデーション
 */

import "server-only";
import crypto from "crypto";

interface AppConfig {
  miro: {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken: string;
  };
  app: {
    url: string;
    nextAuthUrl: string;
    nextAuthSecret: string;
    encryptionKey: string;
  };
  upload: {
    maxFileSize: number;
    allowedFileTypes: string[];
    tempDirectory: string;
    cleanupInterval: number;
  };
  security: {
    tokenExpirationCheck: boolean;
    runtimeValidation: boolean;
    secretRotationInterval: number;
  };
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * 機密情報の検出パターン
 */
const SENSITIVE_PATTERNS = {
  accessToken: /^[a-zA-Z0-9_-]{40,}$/,
  clientSecret: /^[a-fA-F0-9]{32,64}$/,
  apiKey: /^[a-zA-Z0-9_-]{20,}$/,
};

/**
 * 環境変数のセキュリティチェック
 */
function validateEnvironmentSecurity(): {
  isSecure: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // 本番環境での環境変数チェック
  if (process.env.NODE_ENV === "production") {
    // 必要な暗号化キーの存在確認
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
      warnings.push("本番環境では32文字以上の暗号化キーが必要です");
    }

    // HTTPSの確認
    if (
      process.env.NEXT_PUBLIC_APP_URL &&
      !process.env.NEXT_PUBLIC_APP_URL.startsWith("https://")
    ) {
      warnings.push("本番環境ではHTTPSを使用してください");
    }

    // デフォルト値の使用確認
    if (process.env.NEXTAUTH_SECRET === "your-secret-here") {
      warnings.push("本番環境ではデフォルトのシークレットを変更してください");
    }

    // SESSION_SECRETの強度チェック
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      warnings.push("本番環境では32文字以上のSESSION_SECRETが必要です");
    }

    // 弱いシークレットの検出
    const weakSecrets = [
      "development_secret_min_32_chars_required_here",
      "your_secret_here",
      "change_me",
      "CHANGE_THIS",
    ];
    if (
      process.env.SESSION_SECRET &&
      weakSecrets.some((weak) => process.env.SESSION_SECRET?.includes(weak))
    ) {
      warnings.push(
        "SESSION_SECRETが開発用のデフォルト値のままです。強力なランダム文字列に変更してください",
      );
    }
    if (
      process.env.NEXTAUTH_SECRET &&
      weakSecrets.some((weak) => process.env.NEXTAUTH_SECRET?.includes(weak))
    ) {
      warnings.push(
        "NEXTAUTH_SECRETが開発用のデフォルト値のままです。強力なランダム文字列に変更してください",
      );
    }

    // データベースURLのチェック
    if (
      process.env.DATABASE_URL?.includes("localhost") ||
      process.env.DATABASE_URL?.includes("127.0.0.1")
    ) {
      warnings.push("本番環境でlocalhostデータベースを使用しています");
    }
  }

  // 環境変数の露出チェック
  const publicEnvVars = Object.keys(process.env).filter((key) =>
    key.startsWith("NEXT_PUBLIC_"),
  );

  for (const envVar of publicEnvVars) {
    const value = process.env[envVar];
    if (
      value &&
      (SENSITIVE_PATTERNS.accessToken.test(value) ||
        SENSITIVE_PATTERNS.clientSecret.test(value) ||
        SENSITIVE_PATTERNS.apiKey.test(value))
    ) {
      warnings.push(
        `公開環境変数 ${envVar} に機密情報が含まれている可能性があります`,
      );
    }
  }

  return {
    isSecure: warnings.length === 0,
    warnings,
  };
}

/**
 * 機密情報の復号化
 */
function decryptSecret(encryptedText: string, key: string): string {
  if (!key || key.length < 32) {
    throw new Error("復号化キーは32文字以上である必要があります");
  }

  const parts = encryptedText.split(":");

  // 期待形式: iv:ciphertext:tag
  if (parts.length === 3) {
    const [ivHex, encHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const ciphertext = Buffer.from(encHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");

    const derivedKey = crypto.createHash("sha256").update(key).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  // レガシー形式（iv:ciphertext 等）には対応しない
  throw new Error("無効な暗号化形式です");
}

/**
 * 環境変数の安全な取得（将来使用予定）
 */
function _getSecureEnvVar(key: string, isRequired: boolean = true): string {
  const value = process.env[key];

  if (isRequired && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  if (!value) return "";

  // 暗号化された値の検出と復号化
  if (value.includes(":") && process.env.ENCRYPTION_KEY) {
    try {
      return decryptSecret(value, process.env.ENCRYPTION_KEY);
    } catch (_error) {
      console.warn(`Failed to decrypt ${key}, using raw value`);
      return value;
    }
  }

  return value;
}

/**
 * 環境変数から設定を読み込み
 */
function loadConfig(): AppConfig {
  const isServer = typeof window === "undefined";

  // セキュリティチェックの実行
  const securityCheck = validateEnvironmentSecurity();
  if (!securityCheck.isSecure) {
    console.warn("環境変数セキュリティ警告:", securityCheck.warnings);

    // 本番環境でのみ致命的エラーとして扱う（ビルド時は除く）
    if (
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== "phase-production-build"
    ) {
      throw new Error(
        `セキュリティ要件を満たしていません: ${securityCheck.warnings.join(", ")}`,
      );
    }
  }

  if (isServer) {
    const requiredEnvVars = [
      "MIRO_CLIENT_ID",
      "MIRO_CLIENT_SECRET",
      "MIRO_ACCESS_TOKEN",
      "NEXT_PUBLIC_APP_URL",
      "NEXTAUTH_SECRET",
      "SESSION_SECRET", // iron-session用（最低32文字）
    ];

    // 必須環境変数の存在確認
    for (const key of requiredEnvVars) {
      if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }

    // SESSION_SECRETの長さチェック
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters long");
    }
  } else {
    // クライアントサイドでの必須環境変数の確認
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      throw new Error(
        `Missing required environment variable: NEXT_PUBLIC_APP_URL`,
      );
    }
  }

  return {
    miro: {
      clientId: process.env.MIRO_CLIENT_ID ?? "",
      clientSecret: process.env.MIRO_CLIENT_SECRET ?? "",
      accessToken: process.env.MIRO_ACCESS_TOKEN ?? "",
      refreshToken: process.env.MIRO_REFRESH_TOKEN ?? "",
    },
    app: {
      url: process.env.NEXT_PUBLIC_APP_URL!,
      nextAuthUrl: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL!,
      nextAuthSecret: process.env.NEXTAUTH_SECRET ?? "",
      encryptionKey: isServer
        ? process.env.ENCRYPTION_KEY || generateEncryptionKey()
        : "",
    },
    upload: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10), // 10MB
      allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(",") || [
        "image/jpeg",
        "image/png",
        "image/gif",
      ],
      tempDirectory: process.env.TEMP_DIRECTORY || "/tmp",
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || "3600000", 10), // 1時間
    },
    security: {
      tokenExpirationCheck: process.env.TOKEN_EXPIRATION_CHECK === "true",
      runtimeValidation: process.env.RUNTIME_VALIDATION !== "false",
      secretRotationInterval: parseInt(
        process.env.SECRET_ROTATION_INTERVAL || "2592000000",
        10,
      ), // 30日
    },
    isDevelopment: process.env.NODE_ENV === "development",
    isProduction: process.env.NODE_ENV === "production",
  };
}

/**
 * 暗号化キーの生成（開発環境用）
 */
function generateEncryptionKey(): string {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new Error("本番環境では暗号化キーを明示的に設定してください");
  }

  const key = crypto.randomBytes(32).toString("hex");
  console.warn(
    "⚠️  開発用の暗号化キーを生成しました。本番環境では ENCRYPTION_KEY 環境変数を設定してください。",
  );
  return key;
}

/**
 * アプリケーション設定
 */
export const config = loadConfig();

/**
 * 設定の検証
 */
function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const isServer = typeof window === "undefined";

  // Miro設定の検証
  if (!config.miro.clientId || config.miro.clientId.length < 10) {
    errors.push("Invalid Miro Client ID format");
  }

  // アクセストークンの基本形式チェック
  if (!config.miro.accessToken || config.miro.accessToken.length < 20) {
    errors.push("Invalid Miro Access Token format");
  }

  // クライアントシークレットの検証
  if (!config.miro.clientSecret || config.miro.clientSecret.length < 20) {
    errors.push("Invalid Miro Client Secret format");
  }

  // ファイルサイズの検証
  if (
    config.upload.maxFileSize <= 0 ||
    config.upload.maxFileSize > 50 * 1024 * 1024
  ) {
    errors.push("Max file size should be between 1 byte and 50MB");
  }

  // ファイルタイプの検証
  const validMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const invalidTypes = config.upload.allowedFileTypes.filter(
    (type) => !validMimeTypes.includes(type),
  );
  if (invalidTypes.length > 0) {
    errors.push(`Invalid file types: ${invalidTypes.join(", ")}`);
  }

  // セキュリティ設定の検証（サーバーサイドでのみ実行）
  if (isServer && config.isProduction && config.app.encryptionKey.length < 32) {
    errors.push(
      "Production environment requires encryption key of at least 32 characters",
    );
  }

  // HTTPS検証（本番環境）
  if (config.isProduction && !config.app.url.startsWith("https://")) {
    errors.push("Production environment requires HTTPS");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * セキュリティ設定のランタイムチェック
 */
function performSecurityRuntimeCheck(): void {
  if (!config.security.runtimeValidation) {
    return;
  }

  // 環境変数の漏洩チェック
  const sensitiveVars = [
    "MIRO_CLIENT_SECRET",
    "MIRO_ACCESS_TOKEN",
    "NEXTAUTH_SECRET",
  ];

  if (typeof window !== "undefined") {
    // クライアントサイドでの漏洩チェック
    for (const varName of sensitiveVars) {
      if (
        (window as unknown as Record<string, unknown>)[varName] ||
        (window as unknown as { process?: { env?: Record<string, unknown> } })
          .process?.env?.[varName]
      ) {
        console.error(
          `SECURITY WARNING: ${varName} is exposed on client side!`,
        );
      }
    }
  }

  // メモリ使用量のチェック（Node.js環境）
  if (typeof process !== "undefined" && process.memoryUsage) {
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    if (memUsageMB > 500) {
      // 500MB超過で警告
      console.warn(`High memory usage detected: ${memUsageMB}MB`);
    }
  }
}

/**
 * セキュリティ設定のレポート生成
 */
function generateSecurityReport(): {
  timestamp: Date;
  environment: string;
  securityLevel: "low" | "medium" | "high";
  checks: Array<{
    name: string;
    status: "pass" | "fail" | "warning";
    details?: string;
  }>;
} {
  const checks: Array<{
    name: string;
    status: "pass" | "fail" | "warning";
    details?: string;
  }> = [];

  // HTTPS チェック
  checks.push({
    name: "HTTPS Enforcement",
    status:
      config.app.url.startsWith("https://") || config.isDevelopment
        ? "pass"
        : "fail",
    details: config.app.url.startsWith("https://")
      ? undefined
      : "Application is not using HTTPS",
  });

  // 暗号化キー チェック
  checks.push({
    name: "Encryption Key",
    status: config.app.encryptionKey.length >= 32 ? "pass" : "fail",
    details:
      config.app.encryptionKey.length >= 32
        ? undefined
        : "Encryption key is too short",
  });

  // 環境変数セキュリティ チェック
  const envSecurity = validateEnvironmentSecurity();
  checks.push({
    name: "Environment Security",
    status: envSecurity.isSecure ? "pass" : "warning",
    details: envSecurity.isSecure ? undefined : envSecurity.warnings.join(", "),
  });

  // ファイルアップロード制限 チェック
  checks.push({
    name: "File Upload Limits",
    status: config.upload.maxFileSize <= 10 * 1024 * 1024 ? "pass" : "warning",
    details:
      config.upload.maxFileSize > 10 * 1024 * 1024
        ? "File size limit exceeds 10MB"
        : undefined,
  });

  // セキュリティレベルの決定
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;

  let securityLevel: "low" | "medium" | "high";
  if (failCount > 0) {
    securityLevel = "low";
  } else if (warningCount > 1) {
    securityLevel = "medium";
  } else {
    securityLevel = "high";
  }

  return {
    timestamp: new Date(),
    environment: config.isDevelopment ? "development" : "production",
    securityLevel,
    checks,
  };
}

/**
 * 開発環境でのデバッグ情報表示
 */
function debugConfig(): void {
  if (config.isDevelopment) {
    console.log("App Configuration:", {
      miro: {
        clientId: config.miro.clientId.substring(0, 10) + "...",
        hasAccessToken: !!config.miro.accessToken,
        hasRefreshToken: !!config.miro.refreshToken,
        tokenLength: config.miro.accessToken.length,
      },
      app: {
        url: config.app.url,
        environment: process.env.NODE_ENV,
        hasEncryptionKey: !!config.app.encryptionKey,
        encryptionKeyLength: config.app.encryptionKey.length,
      },
      upload: {
        maxFileSize: `${Math.round(config.upload.maxFileSize / 1024 / 1024)}MB`,
        allowedTypes: config.upload.allowedFileTypes,
        tempDirectory: config.upload.tempDirectory,
        cleanupInterval: `${config.upload.cleanupInterval / 1000}s`,
      },
      security: {
        tokenExpirationCheck: config.security.tokenExpirationCheck,
        runtimeValidation: config.security.runtimeValidation,
        secretRotationInterval: `${config.security.secretRotationInterval / (24 * 60 * 60 * 1000)}日`,
      },
    });

    // 設定検証の実行
    const validation = validateConfig();
    if (!validation.isValid) {
      console.warn("Configuration validation errors:", validation.errors);
    }

    // セキュリティレポートの表示
    const securityReport = generateSecurityReport();
    console.log("Security Report:", {
      level: securityReport.securityLevel,
      issues: securityReport.checks.filter((c) => c.status !== "pass"),
    });

    // セキュリティランタイムチェックの実行
    performSecurityRuntimeCheck();
  }
}

// 開発環境での自動デバッグ表示
if (config.isDevelopment && typeof window === "undefined") {
  debugConfig();
}
