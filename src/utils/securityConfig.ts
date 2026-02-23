/**
 * セキュリティ設定とCORS管理
 */

interface SecurityConfig {
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

const securityConfig = getSecurityConfig();

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
