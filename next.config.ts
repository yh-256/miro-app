import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // セキュリティヘッダーの設定
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return [
      {
        // 全てのルートに適用
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "frame-src https://miro.com https://*.miro.com",
              "connect-src 'self' https://api.miro.com https://miro.com https://*.miro.com https://eventhub.eu01.miro.com https://o*.ingest.sentry.io https://www.googletagmanager.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://miro.com https://*.miro.com https://www.googletagmanager.com",
              "img-src 'self' data: blob: https://miro.com https://*.miro.com",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "worker-src 'self' blob:"
            ].join('; ')
          },
          // 本番環境のみHSTSを有効化
          ...(isProduction ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload'
            }
          ] : []),
        ],
      },
    ];
  },

  // 画像最適化の設定
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'miro.com',
      },
      {
        protocol: 'https',
        hostname: '**.miro.com',
      },
    ],
  },

  // 本番環境のパフォーマンス最適化
  ...(process.env.NODE_ENV === 'production' && {
    compress: true,
    poweredByHeader: false,
  }),
};

export default nextConfig;
