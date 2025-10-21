#!/bin/bash

###############################################################################
# PostgreSQLデータベースリストアスクリプト
###############################################################################
#
# 用途:
#   - バックアップファイルからデータベースをリストア
#   - 既存データの警告と確認プロンプト
#   - マイグレーション状態の確認
#
# 使用方法:
#   ./prisma/scripts/restore.sh <backup-file>
#   または
#   npm run prisma:restore <backup-file>
#
# 例:
#   ./prisma/scripts/restore.sh ./backups/backup-20251021-120000.sql.gz
#
# 環境変数:
#   DATABASE_URL - PostgreSQL接続URL（必須）
#
# ⚠️  警告:
#   このスクリプトは既存のデータベースを上書きします！
#   本番環境では特に注意してください。
#
###############################################################################

set -e  # エラー時に即座に終了

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 引数チェック
if [ -z "$1" ]; then
    echo -e "${RED}ERROR: Backup file not specified${NC}"
    echo
    echo "Usage:"
    echo "  $0 <backup-file>"
    echo
    echo "Example:"
    echo "  $0 ./backups/backup-20251021-120000.sql.gz"
    echo
    exit 1
fi

BACKUP_FILE="$1"

# バックアップファイルの存在確認
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}ERROR: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# DATABASE_URLチェック
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

# DATABASE_URLをパース
DB_URL_REGEX="postgres://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^\?]+)"

if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASSWORD="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo -e "${RED}ERROR: Invalid DATABASE_URL format${NC}"
    echo "Expected format: postgres://user:password@host:port/database"
    exit 1
fi

# 情報表示
echo "============================================================"
echo "PostgreSQL Database Restore"
echo "============================================================"
echo -e "${YELLOW}⚠️  WARNING: This will overwrite the current database!${NC}"
echo
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup file: $BACKUP_FILE"
echo "File size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo "============================================================"
echo

# 確認プロンプト
read -p "$(echo -e ${YELLOW}Are you sure you want to restore? This will DELETE all current data! [y/N]: ${NC})" -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Restore cancelled.${NC}"
    exit 0
fi

echo
echo -e "${YELLOW}Starting restore process...${NC}"
echo

export PGPASSWORD="$DB_PASSWORD"

# 一時ファイル作成
TMP_SQL="/tmp/restore-$$.sql"

# バックアップファイルの解凍
echo "1. Extracting backup file..."
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" > "$TMP_SQL"
elif [[ $BACKUP_FILE == *.sql ]]; then
    cp "$BACKUP_FILE" "$TMP_SQL"
else
    echo -e "${RED}ERROR: Unsupported file format. Use .sql or .sql.gz${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Extraction completed${NC}"
echo

# データベース接続確認
echo "2. Checking database connection..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection OK${NC}"
else
    echo -e "${RED}❌ Cannot connect to database${NC}"
    rm -f "$TMP_SQL"
    exit 1
fi

echo

# リストア実行
echo "3. Restoring database..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$TMP_SQL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database restored successfully${NC}"
else
    echo -e "${RED}❌ Restore failed!${NC}"
    echo "Check the error messages above for details."
    rm -f "$TMP_SQL"
    exit 1
fi

echo

# 一時ファイル削除
rm -f "$TMP_SQL"

# マイグレーション状態確認
echo "4. Checking migration status..."
cd "$(dirname "$0")/../.."  # プロジェクトルートへ移動

if command -v npx &> /dev/null; then
    echo
    npx prisma migrate status || true
    echo
else
    echo -e "${YELLOW}⚠️  npx not found. Skipping migration status check.${NC}"
fi

echo
echo "============================================================"
echo -e "${GREEN}Restore process completed!${NC}"
echo "============================================================"
echo
echo "Next steps:"
echo "  1. Verify data integrity"
echo "  2. Check migration status: npx prisma migrate status"
echo "  3. Apply migrations if needed: npx prisma migrate deploy"
echo "  4. Test your application"
echo

unset PGPASSWORD
