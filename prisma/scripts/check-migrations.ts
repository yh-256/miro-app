#!/usr/bin/env ts-node

/**
 * マイグレーション状態確認スクリプト
 * 
 * 用途:
 * - デプロイ前のマイグレーション状態確認
 * - 未適用マイグレーションの検出
 * - データベース接続確認
 * 
 * 使用方法:
 *   npm run prisma:check-migrations
 *   または
 *   ts-node prisma/scripts/check-migrations.ts
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface MigrationCheck {
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string[];
}

async function checkDatabaseConnection(): Promise<MigrationCheck> {
  try {
    await prisma.$connect();
    await prisma.$executeRaw`SELECT 1`;
    return {
      status: 'success',
      message: 'Database connection: OK',
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Database connection: FAILED',
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function getMigrationFiles(): string[] {
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  
  return entries
    .filter(entry => entry.isDirectory() && entry.name !== '_prisma_migrations')
    .map(entry => entry.name)
    .sort();
}

async function checkMigrationStatus(): Promise<MigrationCheck> {
  try {
    // Prisma migrate statusコマンドの実行
    const output = execSync('npx prisma migrate status', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.split('\n');
    const hasWarning = output.toLowerCase().includes('pending') || 
                       output.toLowerCase().includes('not applied');

    if (hasWarning) {
      return {
        status: 'warning',
        message: 'Migration status: PENDING MIGRATIONS FOUND',
        details: lines.filter(line => line.trim() !== ''),
      };
    }

    return {
      status: 'success',
      message: 'Migration status: UP TO DATE',
      details: lines.filter(line => line.trim() !== ''),
    };
  } catch (error) {
    const errorOutput = error instanceof Error && 'stdout' in error
      ? (error as any).stdout?.toString() || (error as any).stderr?.toString()
      : String(error);

    // エラー出力からpendingマイグレーションを検出
    if (errorOutput?.toLowerCase().includes('pending')) {
      return {
        status: 'warning',
        message: 'Migration status: PENDING MIGRATIONS FOUND',
        details: errorOutput.split('\n').filter((line: string) => line.trim() !== ''),
      };
    }

    return {
      status: 'error',
      message: 'Migration status check: FAILED',
      details: [errorOutput || 'Unknown error'],
    };
  }
}

async function checkRequiredTables(): Promise<MigrationCheck> {
  const requiredTables = [
    'users',
    'user_sessions',
    'subjects',
    'problems',
    'problem_progress',
    'insights',
    'upload_sessions',
    'uploaded_items',
  ];

  try {
    const result = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;

    const existingTables = result.map(row => row.tablename);
    const missingTables = requiredTables.filter(
      table => !existingTables.includes(table)
    );

    if (missingTables.length > 0) {
      return {
        status: 'error',
        message: 'Required tables: MISSING',
        details: [
          `Missing tables: ${missingTables.join(', ')}`,
          'Run: npx prisma migrate deploy',
        ],
      };
    }

    return {
      status: 'success',
      message: `Required tables: OK (${requiredTables.length}/${requiredTables.length})`,
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Required tables check: FAILED',
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function printResult(check: MigrationCheck): void {
  const icon = {
    success: '✅',
    warning: '⚠️ ',
    error: '❌',
  }[check.status];

  console.log(`${icon} ${check.message}`);

  if (check.details && check.details.length > 0) {
    check.details.forEach(detail => {
      console.log(`   ${detail}`);
    });
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Database Migration Status Check');
  console.log('='.repeat(60));
  console.log();

  const checks: MigrationCheck[] = [];

  // 1. データベース接続確認
  console.log('1. Checking database connection...');
  const connectionCheck = await checkDatabaseConnection();
  checks.push(connectionCheck);
  printResult(connectionCheck);
  console.log();

  if (connectionCheck.status === 'error') {
    console.log('❌ Cannot proceed without database connection.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // 2. マイグレーション状態確認
  console.log('2. Checking migration status...');
  const migrationCheck = await checkMigrationStatus();
  checks.push(migrationCheck);
  printResult(migrationCheck);
  console.log();

  // 3. 必須テーブル確認
  console.log('3. Checking required tables...');
  const tablesCheck = await checkRequiredTables();
  checks.push(tablesCheck);
  printResult(tablesCheck);
  console.log();

  // 4. マイグレーションファイル一覧
  console.log('4. Migration files:');
  const migrationFiles = getMigrationFiles();
  if (migrationFiles.length > 0) {
    console.log(`   Total: ${migrationFiles.length} migrations`);
    migrationFiles.slice(-5).forEach((file, index) => {
      const prefix = index === migrationFiles.length - 1 ? '   └─' : '   ├─';
      console.log(`${prefix} ${file}`);
    });
    if (migrationFiles.length > 5) {
      console.log(`   └─ ... and ${migrationFiles.length - 5} more`);
    }
  } else {
    console.log('   No migration files found');
  }
  console.log();

  // 結果サマリー
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log('='.repeat(60));

  const hasError = checks.some(check => check.status === 'error');
  const hasWarning = checks.some(check => check.status === 'warning');

  if (hasError) {
    console.log('❌ Status: FAILED');
    console.log('   Fix errors before deploying to production.');
    await prisma.$disconnect();
    process.exit(1);
  } else if (hasWarning) {
    console.log('⚠️  Status: WARNING');
    console.log('   Action required: Apply pending migrations.');
    console.log('   Run: npx prisma migrate deploy');
    await prisma.$disconnect();
    process.exit(0);
  } else {
    console.log('✅ Status: ALL CHECKS PASSED');
    console.log('   Database is ready for production.');
    await prisma.$disconnect();
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  prisma.$disconnect();
  process.exit(1);
});
