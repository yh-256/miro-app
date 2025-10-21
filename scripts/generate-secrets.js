#!/usr/bin/env node

/**
 * 本番環境用の強力なシークレットキーを生成するヘルパースクリプト
 * 
 * 使用方法:
 *   node scripts/generate-secrets.js
 */

const crypto = require('crypto');

console.log('='.repeat(80));
console.log('本番環境用シークレットキー生成ツール');
console.log('='.repeat(80));
console.log();

// SESSION_SECRET生成（base64、32文字以上）
const sessionSecret = crypto.randomBytes(32).toString('base64');
console.log('SESSION_SECRET (iron-session用):');
console.log(sessionSecret);
console.log();

// NEXTAUTH_SECRET生成（base64、32文字以上）
const nextAuthSecret = crypto.randomBytes(32).toString('base64');
console.log('NEXTAUTH_SECRET (NextAuth.js用):');
console.log(nextAuthSecret);
console.log();

// ENCRYPTION_KEY生成（hex、64文字）
const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('ENCRYPTION_KEY (データ暗号化用):');
console.log(encryptionKey);
console.log();

console.log('='.repeat(80));
console.log('⚠️  重要な注意事項:');
console.log('1. 上記のキーを .env.production ファイルにコピーしてください');
console.log('2. これらのキーは絶対にGitにコミットしないでください');
console.log('3. 本番環境でのみ使用し、開発環境では使用しないでください');
console.log('4. キーを紛失すると既存のセッションやデータが復号できなくなります');
console.log('5. 定期的にキーをローテーションすることを推奨します（セッション無効化に注意）');
console.log('='.repeat(80));
console.log();

// .env.production テンプレート出力
console.log('📋 .env.production ファイル例:');
console.log('-'.repeat(80));
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log(`NEXTAUTH_SECRET=${nextAuthSecret}`);
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log('-'.repeat(80));
