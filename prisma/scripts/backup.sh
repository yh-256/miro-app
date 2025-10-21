#!/bin/bash

###############################################################################
# PostgreSQLデータベースバックアップスクリプト
###############################################################################
#
# 用途:
#   - データベース全体をダンプ
#   - 圧縮してタイムスタンプ付きで保存
#   - 古いバックアップの自動削除（デフォルト: 30日以上前）
#
# 使用方法:
#   ./prisma/scripts/backup.sh
#   または
#   npm run prisma:backup
#
# 環境変数:
#   DATABASE_URL - PostgreSQL接続URL（必須）
#   BACKUP_DIR   - バックアップ保存先（デフォルト: ./backups）
#   BACKUP_RETENTION_DAYS - バックアップ保持期間（デフォルト: 30日）
#
###############################################################################

set -e  # エラー時に即座に終了

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 設定
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# DATABASE_URLから接続情報を抽出
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

# DATABASE_URLをパース
# 形式: postgres://user:password@host:port/database
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

# バックアップディレクトリ作成
mkdir -p "$BACKUP_DIR"

# バックアップファイル名
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.sql"
BACKUP_FILE_GZ="$BACKUP_FILE.gz"

echo "============================================================"
echo "PostgreSQL Database Backup"
echo "============================================================"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup file: $BACKUP_FILE_GZ"
echo "============================================================"
echo

# バックアップ実行
echo -e "${YELLOW}Starting backup...${NC}"

export PGPASSWORD="$DB_PASSWORD"

if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --clean --if-exists \
    -f "$BACKUP_FILE"; then
    
    # 圧縮
    echo -e "${YELLOW}Compressing backup...${NC}"
    gzip "$BACKUP_FILE"
    
    # ファイルサイズ確認
    BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
    
    echo -e "${GREEN}✅ Backup completed successfully!${NC}"
    echo "File: $BACKUP_FILE_GZ"
    echo "Size: $BACKUP_SIZE"
    echo
else
    echo -e "${RED}❌ Backup failed!${NC}"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# 古いバックアップの削除
echo -e "${YELLOW}Cleaning up old backups (older than $BACKUP_RETENTION_DAYS days)...${NC}"

OLD_BACKUPS=$(find "$BACKUP_DIR" -name "backup-*.sql.gz" -type f -mtime +$BACKUP_RETENTION_DAYS)

if [ -n "$OLD_BACKUPS" ]; then
    echo "$OLD_BACKUPS" | while read -r file; do
        echo "  Deleting: $file"
        rm -f "$file"
    done
    echo -e "${GREEN}✅ Old backups cleaned up${NC}"
else
    echo "  No old backups to delete"
fi

echo

# バックアップ一覧表示
echo "Current backups:"
ls -lh "$BACKUP_DIR"/backup-*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

echo
echo "============================================================"
echo -e "${GREEN}Backup process completed successfully!${NC}"
echo "============================================================"
echo
echo "To restore this backup, run:"
echo "  ./prisma/scripts/restore.sh $BACKUP_FILE_GZ"
echo

unset PGPASSWORD
