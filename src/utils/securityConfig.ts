/**
 * セキュリティ設定とCORS管理
 */

export interface SecurityConfig {
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };
  headers: {
    contentSecurityPolicy: string;
    xFrameOptions: string;
    xContentTypeOptions: string;
    referrerPolicy: string;
    strictTransportSecurity: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * 環境別セキュリティ設定
 */
function getSecurityConfig(): SecurityConfig {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  return {
    cors: {
      allowedOrigins: isDevelopment
        ? ["http://localhost:3000", "http://127.0.0.1:3000"]
        : process.env.ALLOWED_ORIGINS?.split(",") || ["https://yourdomain.com"],
      allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
      credentials: false, // Cookieを使用しないため false
      maxAge: 86400, // 24時間
    },
    headers: {
      contentSecurityPolicy: isDevelopment
        ? "default-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob:; connect-src 'self' https://api.miro.com; frame-src 'self' https://miro.com; img-src 'self' data: blob: https:;"
        : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.miro.com; frame-src 'self' https://miro.com; img-src 'self' data: blob: https:; object-src 'none'; base-uri 'self';",
      xFrameOptions: "DENY",
      xContentTypeOptions: "nosniff",
      referrerPolicy: "strict-origin-when-cross-origin",
      strictTransportSecurity: isProduction
        ? "max-age=31536000; includeSubDomains; preload"
        : "",
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15分
      maxRequests: isDevelopment ? 1000 : 100, // 開発環境では制限を緩める
    },
  };
}

export const securityConfig = getSecurityConfig();

/**
 * CORSヘッダーの生成
 */
export function generateCorsHeaders(origin?: string): Record<string, string> {
  const config = securityConfig.cors;
  const headers: Record<string, string> = {};

  // Origin チェック
  if (origin && config.allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (config.allowedOrigins.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  headers["Access-Control-Allow-Methods"] = config.allowedMethods.join(", ");
  headers["Access-Control-Allow-Headers"] = config.allowedHeaders.join(", ");
  headers["Access-Control-Max-Age"] = config.maxAge.toString();

  if (config.credentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

/**
 * セキュリティヘッダーの生成
 */
export function generateSecurityHeaders(): Record<string, string> {
  const config = securityConfig.headers;
  const headers: Record<string, string> = {};

  if (config.contentSecurityPolicy) {
    headers["Content-Security-Policy"] = config.contentSecurityPolicy;
  }

  if (config.xFrameOptions) {
    headers["X-Frame-Options"] = config.xFrameOptions;
  }

  if (config.xContentTypeOptions) {
    headers["X-Content-Type-Options"] = config.xContentTypeOptions;
  }

  if (config.referrerPolicy) {
    headers["Referrer-Policy"] = config.referrerPolicy;
  }

  if (config.strictTransportSecurity) {
    headers["Strict-Transport-Security"] = config.strictTransportSecurity;
  }

  // 追加のセキュリティヘッダー
  headers["X-XSS-Protection"] = "1; mode=block";
  headers["X-DNS-Prefetch-Control"] = "off";
  headers["X-Download-Options"] = "noopen";
  headers["X-Permitted-Cross-Domain-Policies"] = "none";

  return headers;
}

/**
 * プリフライトリクエストのチェック
 */
export function isPreflightRequest(
  method: string,
  headers: Record<string, string | undefined>,
): boolean {
  return (
    method === "OPTIONS" &&
    headers["access-control-request-method"] !== undefined
  );
}

/**
 * オリジンの検証
 */
export function isValidOrigin(origin?: string): boolean {
  if (!origin) return true; // Same-origin requests

  const config = securityConfig.cors;

  // 開発環境では localhost を許可
  if (process.env.NODE_ENV === "development") {
    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    ) {
      return true;
    }
  }

  return (
    config.allowedOrigins.includes(origin) ||
    config.allowedOrigins.includes("*")
  );
}

/**
 * レート制限のキー生成
 */
export function generateRateLimitKey(req: {
  headers: Record<string, string | string[] | undefined>;
  connection?: { remoteAddress?: string };
}): string {
  // IP アドレスベースのレート制限
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded
    ? typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : forwarded[0]
    : req.headers["x-real-ip"] || req.connection?.remoteAddress || "unknown";

  return `rate_limit:${ip}`;
}

/**
 * セキュリティ違反のログ記録
 */
export function logSecurityViolation(
  type: "cors" | "rate_limit" | "invalid_origin" | "malicious_request",
  details: {
    origin?: string;
    ip?: string;
    userAgent?: string;
    url?: string;
    method?: string;
    timestamp?: Date;
  },
): void {
  const logEntry = {
    type,
    timestamp: details.timestamp || new Date(),
    ...details,
  };

  console.warn("Security Violation:", logEntry);

  // 本番環境では外部セキュリティサービスに送信
  if (process.env.NODE_ENV === "production") {
    // TODO: 外部セキュリティ監視サービスへの送信
    // 例: Sentry, DataDog, CloudWatch など
  }
}

/**
 * セキュリティミドルウェア用のレスポンスヘルパー
 */
export class SecurityResponse {
  static forbidden(message: string = "Forbidden"): Response {
    return new Response(JSON.stringify({ error: message }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        ...generateSecurityHeaders(),
      },
    });
  }

  static tooManyRequests(retryAfter?: number): Response {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...generateSecurityHeaders(),
    };

    if (retryAfter) {
      headers["Retry-After"] = retryAfter.toString();
    }

    return new Response(
      JSON.stringify({
        error: "Too Many Requests",
        message:
          "レート制限に達しました。しばらく待ってから再試行してください。",
      }),
      { status: 429, headers },
    );
  }

  static corsError(): Response {
    return new Response(JSON.stringify({ error: "CORS Error" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        ...generateSecurityHeaders(),
      },
    });
  }

  static withSecurityHeaders(response: Response): Response {
    const securityHeaders = generateSecurityHeaders();

    // 既存のヘッダーを保持しつつ、セキュリティヘッダーを追加
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
}

/**
 * Content-Security-Policy 違反レポートの処理
 */
export function handleCSPViolation(report: Record<string, unknown>): void {
  console.warn("CSP Violation Report:", {
    blockedURI: report["blocked-uri"],
    documentURI: report["document-uri"],
    violatedDirective: report["violated-directive"],
    originalPolicy: report["original-policy"],
    timestamp: new Date(),
  });

  // CSP違反の分析とアラート
  if (process.env.NODE_ENV === "production") {
    // TODO: CSP違反の統計とアラート機能
  }
}

/**
 * セキュリティ設定の検証
 */
export function validateSecurityConfig(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const config = securityConfig;

  // CORS設定の検証
  if (config.cors.allowedOrigins.length === 0) {
    errors.push("CORS: allowedOrigins が設定されていません");
  }

  if (config.cors.allowedOrigins.includes("*") && config.cors.credentials) {
    errors.push(
      "CORS: credentials が true の場合、origin に * は使用できません",
    );
  }

  // CSP設定の検証
  if (!config.headers.contentSecurityPolicy.includes("default-src")) {
    errors.push("CSP: default-src ディレクティブが必要です");
  }

  // HTTPS強制の確認（本番環境）
  if (
    process.env.NODE_ENV === "production" &&
    !config.headers.strictTransportSecurity
  ) {
    errors.push(
      "Production: Strict-Transport-Security ヘッダーが設定されていません",
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
