# データベース運用ガイド

## 概要

このドキュメントでは、Miro Image Upload Appのデータベース運用に関する手順とベストプラクティスを説明します。

---

## 📊 データベース設計

### 使用技術
- **DBMS**: PostgreSQL 14.x以上
- **ORM**: Prisma 5.x
- **マイグレーションツール**: Prisma Migrate

### スキーマ構成

#### 主要テーブル

| テーブル名 | 用途 | 主なリレーション |
|-----------|------|------------------|
| `users` | 認証ユーザー情報 | → user_sessions |
| `user_sessions` | セッション管理 | → users, problems, uploads |
| `subjects` | 被写体（個人ID）管理 | → uploaded_items |
| `problems` | 問題情報 | → insights, progress, uploads |
| `problem_progress` | 問題進捗状況 | → problems, user_sessions |
| `insights` | 気づき投稿 | → problems, user_sessions |
| `upload_sessions` | アップロードセッション | → problems, user_sessions, items |
| `uploaded_items` | アップロード画像情報 | → sessions, subjects, problems |

### インデックス戦略

```sql
-- 頻繁に検索されるカラムにインデックスを設定
CREATE INDEX ON users (user_id);
CREATE INDEX ON user_sessions (user_id);
CREATE INDEX ON problems (order_index);
CREATE INDEX ON uploaded_items (subject_id);
CREATE INDEX ON uploaded_items (problem_id);
```

**Prismaスキーマで定義済み:**
- `@@index([userId])` - users.userId
- `@@index([sessionId])` - uploaded_items.sessionId
- その他、外部キー関連の自動インデックス

---

## 🔧 接続設定

### 接続プーリング

**DATABASE_URL形式:**
```bash
postgres://user:password@host:5432/database?connection_limit=10&pool_timeout=5&connect_timeout=10&sslmode=require
```

**パラメータ説明:**
- `connection_limit=10` - インスタンスあたりの最大接続数
- `pool_timeout=5` - プールからの接続取得タイムアウト（秒）
- `connect_timeout=10` - 接続確立タイムアウト（秒）
- `sslmode=require` - SSL/TLS接続を強制

### 接続数の計算

```
総接続数 = アプリケーションインスタンス数 × connection_limit

例:
- Vercelで5インスタンス × 10接続 = 50接続
- PostgreSQLのmax_connections（デフォルト100）より小さくする
```

**推奨設定:**
- 開発環境: `connection_limit=5`
- 本番環境: `connection_limit=10`
- PostgreSQL: `max_connections=100`（余裕を持たせる）

---

## 📝 マイグレーション

### 開発環境でのマイグレーション作成

```bash
# 1. スキーマ変更
nano prisma/schema.prisma

# 2. マイグレーション生成
npm run prisma:migrate

# 3. マイグレーション名入力
# 例: add_email_field

# 4. 自動適用される
```

### 本番環境へのマイグレーション適用

#### 事前チェック
```bash
# マイグレーション状態確認
npm run prisma:check-migrations

# または
npm run prisma:migrate:status
```

#### バックアップ
```bash
# 必ずバックアップを取得
npm run prisma:backup
```

#### マイグレーション適用
```bash
# 本番環境での適用
npm run prisma:migrate:deploy
```

#### 確認
```bash
# 適用後の確認
npm run prisma:check-migrations
```

### マイグレーションのロールバック

```bash
# 1. バックアップからリストア
npm run prisma:restore backups/backup-YYYYMMDD-HHMMSS.sql.gz

# 2. 特定マイグレーションを解決済みとしてマーク
npx prisma migrate resolve --rolled-back <migration-name>

# 3. 状態確認
npm run prisma:migrate:status
```

---

## 💾 バックアップ・リストア

### 自動バックアップ設定

#### Cron設定例（Linux/Mac）

```bash
# crontab編集
crontab -e

# 毎日午前3時にバックアップ
0 3 * * * cd /path/to/miro-app && npm run prisma:backup

# 毎週日曜日午前3時にバックアップ
0 3 * * 0 cd /path/to/miro-app && npm run prisma:backup
```

### 手動バックアップ

```bash
# 基本的な使用方法
npm run prisma:backup

# カスタムバックアップディレクトリ
BACKUP_DIR=/var/backups/miro-app npm run prisma:backup

# 保持期間を60日に設定
BACKUP_RETENTION_DAYS=60 npm run prisma:backup
```

**バックアップファイル:**
- 場所: `./backups/`
- 形式: `backup-YYYYMMDD-HHMMSS.sql.gz`
- 圧縮: gzip

### リストア

```bash
# バックアップからリストア
npm run prisma:restore backups/backup-20251021-120000.sql.gz

# 確認プロンプトが表示される
# ⚠️  WARNING: This will overwrite the current database!
# Are you sure you want to restore? This will DELETE all current data! [y/N]:
```

**⚠️  警告:**
- リストアは既存データを完全に上書きします
- 本番環境では特に慎重に実行してください
- 必ず事前にバックアップを取得してください

### バックアップのベストプラクティス

1. **定期的なバックアップ**
   - 日次: 本番データベース
   - マイグレーション前: 必須

2. **バックアップの検証**
   ```bash
   # バックアップファイルの内容確認
   gunzip -c backups/backup-20251021-120000.sql.gz | head -n 50
   
   # バックアップからのリストアテスト（ステージング環境）
   npm run prisma:restore backups/backup-20251021-120000.sql.gz
   ```

3. **オフサイトバックアップ**
   ```bash
   # S3へアップロード例
   aws s3 cp backups/backup-20251021-120000.sql.gz s3://your-bucket/backups/
   
   # rsyncで別サーバーへコピー
   rsync -avz backups/ backup-server:/backups/miro-app/
   ```

---

## 🔍 モニタリング

### データベース接続数の確認

```sql
-- 現在の接続数
SELECT count(*) FROM pg_stat_activity;

-- 接続の詳細
SELECT 
  datname,
  count(*) as connections,
  max(backend_start) as latest_connection
FROM pg_stat_activity
GROUP BY datname;
```

### クエリパフォーマンス

```sql
-- 遅いクエリの確認
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### ディスク使用量

```sql
-- テーブルサイズ
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🚨 トラブルシューティング

### よくあるエラーと対処法

#### 1. 接続プール枯渇
```
Error: Can't reach database server
```

**原因:** 接続数が上限に達している

**対処法:**
```bash
# 1. 接続数を確認
SELECT count(*) FROM pg_stat_activity;

# 2. CONNECTION_LIMITを調整
# DATABASE_URL に ?connection_limit=5 を追加

# 3. PostgreSQLのmax_connectionsを増やす
ALTER SYSTEM SET max_connections = 200;
SELECT pg_reload_conf();
```

#### 2. マイグレーション失敗
```
Error: Migration failed to apply
```

**対処法:**
```bash
# 1. バックアップからリストア
npm run prisma:restore backups/backup-latest.sql.gz

# 2. マイグレーション状態を確認
npm run prisma:migrate:status

# 3. 失敗したマイグレーションを解決済みとしてマーク
npx prisma migrate resolve --rolled-back <migration-name>

# 4. 再度マイグレーション適用
npm run prisma:migrate:deploy
```

#### 3. デッドロック
```
Error: deadlock detected
```

**原因:** 複数のトランザクションが互いにロックを待機

**対処法:**
```typescript
// アプリケーション側でリトライロジック実装
async function executeWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === '40P01' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

#### 4. ディスク容量不足
```
Error: could not extend file
```

**対処法:**
```bash
# 1. 不要なデータの削除
DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '30 days';

# 2. VACUUM実行
VACUUM FULL;

# 3. ディスク容量の拡張（ホスティングサービスの管理画面）
```

---

## 📈 パフォーマンスチューニング

### インデックス追加

```sql
-- 頻繁に検索されるカラムにインデックス追加
CREATE INDEX idx_uploaded_items_created_at ON uploaded_items(created_at);
CREATE INDEX idx_insights_problem_id_created_at ON insights(problem_id, created_at);

-- 複合インデックス
CREATE INDEX idx_problem_progress_composite ON problem_progress(user_session_id, status);
```

### クエリ最適化

```typescript
// ❌ N+1問題
const problems = await prisma.problem.findMany();
for (const problem of problems) {
  const insights = await prisma.insight.findMany({ where: { problemId: problem.id } });
}

// ✅ includeで一括取得
const problems = await prisma.problem.findMany({
  include: { insights: true }
});
```

### 接続プール調整

```bash
# 負荷に応じて調整
# 低負荷: connection_limit=5
# 中負荷: connection_limit=10
# 高負荷: connection_limit=20（PostgreSQLのmax_connectionsに注意）
```

---

## 🔐 セキュリティ

### バックアップファイルの保護

```bash
# パーミッション設定（所有者のみ読み書き可能）
chmod 600 backups/*.sql.gz

# 暗号化（オプション）
gpg --encrypt --recipient your-email@example.com backups/backup-latest.sql.gz
```

### DATABASE_URLの管理

- ❌ コード内にハードコード
- ❌ Gitにコミット
- ✅ 環境変数として管理
- ✅ シークレット管理サービス使用（AWS Secrets Manager等）

### SSL/TLS接続

```bash
# DATABASE_URLにsslmode=requireを追加
DATABASE_URL="postgres://user:pass@host:5432/db?sslmode=require"
```

---

## 📚 参考リンク

- [Prisma公式ドキュメント](https://www.prisma.io/docs)
- [PostgreSQL公式ドキュメント](https://www.postgresql.org/docs/)
- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [PostgreSQL Backup and Recovery](https://www.postgresql.org/docs/current/backup.html)

---

## 🆘 サポート

問題が発生した場合:
1. このドキュメントのトラブルシューティングセクションを確認
2. `npm run prisma:check-migrations`で状態確認
3. バックアップが最新であることを確認
4. 本番環境での作業前にステージング環境でテスト
