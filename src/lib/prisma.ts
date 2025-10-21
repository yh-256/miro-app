import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma Client設定
 * 
 * 本番環境での最適化:
 * - 接続プーリング: DATABASE_URLに ?connection_limit=N を追加
 * - エラーフォーマット: 本番では最小化
 * - ログレベル: 本番では警告とエラーのみ
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Prisma Clientインスタンス作成
export const prisma =
  global.prisma ??
  new PrismaClient({
    log: isDevelopment
      ? ['query', 'info', 'warn', 'error']
      : [
          { level: 'warn', emit: 'stdout' },
          { level: 'error', emit: 'stdout' },
        ],
    errorFormat: isProduction ? 'minimal' : 'pretty',
  });

// 開発環境ではグローバルに保存（Hot Reloadでの再作成を防ぐ）
if (!isProduction) {
  global.prisma = prisma;
}

// Prisma Clientのグレースフルシャットダウン
if (isProduction) {
  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
