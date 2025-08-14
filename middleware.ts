import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js セキュリティミドルウェア
 * CORS、セキュリティヘッダー、レート制限を処理
 */

// レート制限用のメモリストア（本番環境では Redis 等を使用）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// セキュリティ設定
const SECURITY_CONFIG = {
  cors: {
    allowedOrigins: process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://127.0.0.1:3000']
      : (process.env.ALLOWED_ORIGINS?.split(',') || []),
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    maxAge: 86400, // 24時間
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分
    maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 100,
  },
};

export function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;
  const method = request.method;
  const requestOrigin = request.headers.get('origin');

  // API ルートに対してのみミドルウェアを適用
  if (pathname.startsWith('/api/')) {
    
    // レート制限チェック
    const rateLimitResult = checkRateLimit(request);
    if (!rateLimitResult.allowed) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Too Many Requests',
          message: 'レート制限に達しました。しばらく待ってから再試行してください。'
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
            ...getSecurityHeaders(),
          },
        }
      );
    }

    // CORS プリフライトリクエストの処理
    if (method === 'OPTIONS') {
      return handlePreflightRequest(request);
    }

    // Origin の検証
    if (requestOrigin && !isValidOrigin(requestOrigin)) {
      console.warn('Invalid origin blocked:', {
        origin: requestOrigin,
        pathname,
        timestamp: new Date().toISOString(),
      });

      return new NextResponse(
        JSON.stringify({ error: 'CORS Error', message: '許可されていないオリジンです。' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...getSecurityHeaders(),
          },
        }
      );
    }

    // 通常のリクエストにセキュリティヘッダーとCORSヘッダーを追加
    const response = NextResponse.next();
    
    // CORS ヘッダーの追加
    if (requestOrigin && isValidOrigin(requestOrigin)) {
      response.headers.set('Access-Control-Allow-Origin', requestOrigin);
    }
    response.headers.set('Access-Control-Allow-Methods', SECURITY_CONFIG.cors.allowedMethods.join(', '));
    response.headers.set('Access-Control-Allow-Headers', SECURITY_CONFIG.cors.allowedHeaders.join(', '));
    response.headers.set('Access-Control-Max-Age', SECURITY_CONFIG.cors.maxAge.toString());

    // セキュリティヘッダーの追加
    const securityHeaders = getSecurityHeaders();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  // 静的ファイルやページに対するセキュリティヘッダー
  const response = NextResponse.next();
  const securityHeaders = getSecurityHeaders();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * プリフライトリクエストの処理
 */
function handlePreflightRequest(request: NextRequest): NextResponse {
  const requestOrigin = request.headers.get('origin');
  
  if (!requestOrigin || !isValidOrigin(requestOrigin)) {
    return new NextResponse(null, {
      status: 403,
      headers: getSecurityHeaders(),
    });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': requestOrigin,
      'Access-Control-Allow-Methods': SECURITY_CONFIG.cors.allowedMethods.join(', '),
      'Access-Control-Allow-Headers': SECURITY_CONFIG.cors.allowedHeaders.join(', '),
      'Access-Control-Max-Age': SECURITY_CONFIG.cors.maxAge.toString(),
      ...getSecurityHeaders(),
    },
  });
}

/**
 * Origin の検証
 */
function isValidOrigin(origin: string): boolean {
  // 開発環境での localhost の許可
  if (process.env.NODE_ENV === 'development') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }

  return SECURITY_CONFIG.cors.allowedOrigins.includes(origin);
}

/**
 * レート制限のチェック
 */
function checkRateLimit(request: NextRequest): { allowed: boolean; resetTime: number } {
  const clientId = getClientId(request);
  const now = Date.now();
  const windowMs = SECURITY_CONFIG.rateLimit.windowMs;
  const maxRequests = SECURITY_CONFIG.rateLimit.maxRequests;

  // 既存のレート制限データを取得
  let rateLimitData = rateLimitStore.get(clientId);

  // データが存在しない、または期限切れの場合は新しく作成
  if (!rateLimitData || now > rateLimitData.resetTime) {
    rateLimitData = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(clientId, rateLimitData);
    return { allowed: true, resetTime: rateLimitData.resetTime - now };
  }

  // リクエスト数を増加
  rateLimitData.count++;

  // 制限を超えているかチェック
  if (rateLimitData.count > maxRequests) {
    return { allowed: false, resetTime: rateLimitData.resetTime - now };
  }

  return { allowed: true, resetTime: rateLimitData.resetTime - now };
}

/**
 * クライアント識別子の取得
 */
function getClientId(request: NextRequest): string {
  // X-Forwarded-For ヘッダーから IP アドレスを取得
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded 
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') || 'unknown';
  
  return `rate_limit:${ip}`;
}

/**
 * セキュリティヘッダーの生成
 */
function getSecurityHeaders(): Record<string, string> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    // Content Security Policy
    'Content-Security-Policy': isDevelopment
      ? "default-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob:; connect-src 'self' https://api.miro.com https://miro.com; frame-src 'self' https://miro.com; img-src 'self' data: blob: https:; font-src 'self' data:;"
      : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.miro.com; frame-src 'self' https://miro.com; img-src 'self' data: blob: https:; object-src 'none'; base-uri 'self'; font-src 'self' data:;",
    
    // X-Frame-Options
    'X-Frame-Options': 'DENY',
    
    // X-Content-Type-Options
    'X-Content-Type-Options': 'nosniff',
    
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // X-XSS-Protection
    'X-XSS-Protection': '1; mode=block',
    
    // X-DNS-Prefetch-Control
    'X-DNS-Prefetch-Control': 'off',
    
    // X-Download-Options
    'X-Download-Options': 'noopen',
    
    // X-Permitted-Cross-Domain-Policies
    'X-Permitted-Cross-Domain-Policies': 'none',
    
    // Strict-Transport-Security (HTTPS環境のみ)
    ...(isProduction && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    }),
  };
}

/**
 * 古いレート制限データのクリーンアップ
 * 本番環境では定期的にクリーンアップするか、Redis等を使用
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// 10分ごとにクリーンアップを実行
if (typeof window === 'undefined') { // サーバーサイドでのみ実行
  setInterval(cleanupRateLimitStore, 10 * 60 * 1000);
}

// ミドルウェアを適用するパスの設定
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};