# 環境変数設定ガイド

## 概要

このアプリケーションは環境変数を使用して、Miro API認証情報、データベース接続、セキュリティ設定などを管理します。

## 環境別の設定ファイル

### 開発環境
- **ファイル**: `.env.local`
- **用途**: ローカル開発時の設定
- **Git管理**: ❌ コミット禁止（`.gitignore`で除外済み）

### 本番環境
- **ファイル**: `.env.production`
- **用途**: 本番環境での設定
- **Git管理**: ❌ 絶対にコミット禁止
- **テンプレート**: `.env.production.example` を参照

### テンプレートファイル
- `.env.example` - 開発環境用テンプレート
- `.env.production.example` - 本番環境用テンプレート

## セットアップ手順

### 開発環境のセットアップ

1. テンプレートをコピー:
   ```bash
   cp .env.example .env.local
   ```

2. 必要な値を設定:
   - Miro APIの認証情報を[Miro Developer Console](https://developers.miro.com/)から取得
   - データベース接続情報を設定
   - SESSION_SECRETを設定（開発環境では既定値でも可）

3. 動作確認:
   ```bash
   npm run dev
   ```

### 本番環境のセットアップ

1. テンプレートをコピー:
   ```bash
   cp .env.production.example .env.production
   ```

2. 強力なシークレットキーを生成:
   ```bash
   npm run generate:secrets
   ```
   
   出力された値を `.env.production` にコピーします。

3. 必須項目を設定:
   - `MIRO_CLIENT_ID`, `MIRO_CLIENT_SECRET`, `MIRO_ACCESS_TOKEN` - 本番用Miroアプリの認証情報
   - `NEXT_PUBLIC_APP_URL` - 本番ドメイン（**必ずHTTPS**）
   - `DATABASE_URL` - 本番データベースの接続URL
   - `SESSION_SECRET` - 生成したランダム文字列（最低32文字）
   - `NEXTAUTH_SECRET` - 生成したランダム文字列（最低32文字）
   - `ENCRYPTION_KEY` - 生成したランダム文字列（64文字hex）

4. セキュリティチェック:
   ```bash
   npm run build
   ```
   
   警告が表示された場合は該当項目を修正してください。

## 必須環境変数

### Miro API（必須）
```bash
MIRO_CLIENT_ID=your_miro_client_id
MIRO_CLIENT_SECRET=your_miro_client_secret
MIRO_ACCESS_TOKEN=your_miro_access_token
MIRO_REFRESH_TOKEN=your_miro_refresh_token
```

### アプリケーション（必須）
```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com  # 本番環境はHTTPS必須
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<32文字以上のランダム文字列>
```

### セッション管理（必須）
```bash
SESSION_SECRET=<32文字以上のランダム文字列>
```

⚠️ **重要**: SESSION_SECRETは最低32文字必要です。これより短いとアプリケーションが起動しません。

### データベース（必須）
```bash
DATABASE_URL=postgres://user:password@host:port/database
```

## オプション環境変数

### ファイルアップロード
```bash
MAX_FILE_SIZE=10485760  # デフォルト: 10MB
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif
TEMP_UPLOAD_DIR=/var/tmp/miro-app-uploads
TEMP_FILE_CLEANUP_INTERVAL=3600000  # デフォルト: 1時間
```

### セキュリティ
```bash
ALLOWED_ORIGINS=https://your-domain.com
RATE_LIMIT_WINDOW_MS=900000  # デフォルト: 15分
RATE_LIMIT_MAX_REQUESTS=100
ENCRYPTION_KEY=<64文字のhex文字列>
```

### ロギング
```bash
LOG_LEVEL=info  # error, warn, info, debug
LOG_FORMAT=json  # json, text
```

## セキュリティチェック

アプリケーションは起動時に以下をチェックします:

### 本番環境で必須
- ✅ HTTPSの使用（`NEXT_PUBLIC_APP_URL`が`https://`で始まる）
- ✅ SESSION_SECRETが32文字以上
- ✅ デフォルト値からの変更（`CHANGE_THIS`等が含まれていない）
- ✅ localhostではないデータベース接続

### 警告が出る場合
```
環境変数セキュリティ警告: [ '本番環境ではHTTPSを使用してください' ]
```

本番環境（`NODE_ENV=production`）でこの警告が出た場合、アプリケーションは起動しません。該当項目を修正してください。

## トラブルシューティング

### SESSION_SECRET エラー
```
Error: SESSION_SECRET must be at least 32 characters long
```

**解決方法**:
```bash
npm run generate:secrets
```
で生成された`SESSION_SECRET`を使用してください。

### 環境変数が読み込まれない
- Next.jsは`.env.local`を優先的に読み込みます
- 本番環境では`.env.production`が使用されます
- 変更後はサーバーを再起動してください

### ビルドエラー
```
Missing required environment variable: XXX
```

**解決方法**: `.env.example`または`.env.production.example`を参照し、不足している環境変数を設定してください。

## ベストプラクティス

### ✅ 推奨
- 本番環境と開発環境で異なるMiroアプリケーションを使用
- SESSION_SECRETとNEXTAUTH_SECRETに異なる値を使用
- 定期的にシークレットキーをローテーション（セッション無効化に注意）
- `.env.production`はデプロイ環境の環境変数として設定（ファイルとして配置しない）

### ❌ 避けるべき
- シークレットキーをGitにコミット
- 本番環境で開発用の認証情報を使用
- 弱いシークレットキー（`password123`等）
- HTTP接続（本番環境）

## シークレットキー生成コマンド

### openssl を使用
```bash
# SESSION_SECRET / NEXTAUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY
openssl rand -hex 32
```

### npm スクリプトを使用（推奨）
```bash
npm run generate:secrets
```

このコマンドで必要な全てのシークレットキーが一度に生成されます。

## 環境変数の優先順位

Next.jsは以下の優先順位で環境変数を読み込みます:

1. `.env.local` (最優先、Gitで無視)
2. `.env.production` / `.env.development` (環境別)
3. `.env` (共通設定)

**本番デプロイ時**: 環境変数は通常、ホスティングプラットフォーム（Vercel, Railway等）のUIから設定します。
