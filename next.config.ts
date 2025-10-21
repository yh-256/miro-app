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
            key: 'X-Frame-Options',
            value: 'DENY'
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

