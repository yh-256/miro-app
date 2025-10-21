# デプロイ手順書

## 概要

このドキュメントでは、Miro Image Upload Appを本番環境にデプロイする手順を説明します。

---

## 前提条件

### 必須
- ✅ Node.js 20.x 以上
- ✅ PostgreSQL 14.x 以上
- ✅ Miro Developer Accountと本番用アプリケーション
- ✅ HTTPSが設定されたドメイン

### 推奨
- 💡 Git リポジトリ（GitHub, GitLab等）
- 💡 環境変数管理ツール（ホスティングサービスのUI、または1Password等）
- 💡 監視ツール（Sentry, DataDog等）

---

## デプロイ方法別ガイド

### Option 1: Vercel（推奨・最も簡単）

#### メリット
- ✅ 自動HTTPS設定
- ✅ 環境変数管理UI
- ✅ 自動デプロイ（Git連携）
- ✅ エッジネットワーク対応
- ✅ 無料プランあり

#### 手順

1. **Vercelアカウント作成**
   - https://vercel.com でアカウント作成
   - GitHubと連携

2. **プロジェクトのインポート**
   ```bash
   # Vercel CLIをインストール（オプション）
   npm install -g vercel
   
   # プロジェクトディレクトリで実行
   vercel
   ```

3. **環境変数の設定**
   
   Vercel Dashboard → Settings → Environment Variables で以下を設定:
   
   ```bash
   # Miro API
   MIRO_CLIENT_ID=<本番用クライアントID>
   MIRO_CLIENT_SECRET=<本番用シークレット>
   MIRO_ACCESS_TOKEN=<本番用アクセストークン>
   MIRO_REFRESH_TOKEN=<本番用リフレッシュトークン>
   
   # アプリケーション（自動設定されるが確認）
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   NEXTAUTH_URL=https://your-app.vercel.app
   
   # シークレットキー（npm run generate:secrets で生成）
   SESSION_SECRET=<生成したSESSION_SECRET>
   NEXTAUTH_SECRET=<生成したNEXTAUTH_SECRET>
   ENCRYPTION_KEY=<生成したENCRYPTION_KEY>
   
   # データベース（Vercel Postgres または外部DB）
   DATABASE_URL=<PostgreSQL接続URL>
   
   # その他
   NODE_ENV=production
   ```

4. **データベースのセットアップ**
   
   **Option A: Vercel Postgres（推奨）**
   ```bash
   # Vercel Dashboard から Postgres を追加
   # 自動的に DATABASE_URL が設定される
   ```
   
   **Option B: 外部PostgreSQL**
   ```bash
   # Supabase, Neon, Railway等のPostgreSQLサービスを使用
   # DATABASE_URL を手動で設定
   ```

5. **マイグレーション実行**
   
   Vercel Dashboard → Deployments → ... → Run Command:
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

6. **デプロイ**
   - Gitリポジトリにpush → 自動デプロイ
   - または `vercel --prod` で手動デプロイ

7. **確認**
   ```bash
   # ヘルスチェック
   curl https://your-app.vercel.app/api/health
   
   # ログイン機能確認
   # ブラウザで https://your-app.vercel.app/login にアクセス
   ```

---

### Option 2: Railway

#### メリット
- ✅ データベース統合管理
- ✅ 自動HTTPS
- ✅ シンプルなUI
- ✅ Git連携デプロイ

#### 手順

1. **Railwayアカウント作成**
   - https://railway.app でアカウント作成

2. **新しいプロジェクト作成**
   - "New Project" → "Deploy from GitHub repo"
   - リポジトリを選択

3. **PostgreSQLを追加**
   - "New" → "Database" → "PostgreSQL"
   - 自動的に `DATABASE_URL` が環境変数に追加される

4. **環境変数の設定**
   
   Variables タブで設定:
   ```bash
   MIRO_CLIENT_ID=...
   MIRO_CLIENT_SECRET=...
   MIRO_ACCESS_TOKEN=...
   MIRO_REFRESH_TOKEN=...
   
   NEXT_PUBLIC_APP_URL=https://<your-railway-domain>.up.railway.app
   NEXTAUTH_URL=https://<your-railway-domain>.up.railway.app
   SESSION_SECRET=...
   NEXTAUTH_SECRET=...
   ENCRYPTION_KEY=...
   
   NODE_ENV=production
   ```

5. **ビルド設定**
   
   Settings → Build Command:
   ```bash
   npm install && npm run build
   ```
   
   Settings → Start Command:
   ```bash
   npm start
   ```

6. **マイグレーション**
   
   Railway Dashboard → Service → "Run Command":
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

7. **カスタムドメイン設定（オプション）**
   - Settings → Domains → "Add Domain"

---

### Option 3: 自社サーバー（VPS, AWS EC2等）

#### 必要なもの
- Ubuntu 22.04 LTS（推奨）
- Nginx または Apache
- SSL証明書（Let's Encrypt推奨）
- PostgreSQL

#### 手順

1. **サーバーの準備**
   ```bash
   # Node.js インストール
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # PostgreSQL インストール
   sudo apt-get install postgresql postgresql-contrib
   
   # Nginx インストール
   sudo apt-get install nginx
   ```

2. **データベースのセットアップ**
   ```bash
   # PostgreSQLユーザーとデータベース作成
   sudo -u postgres psql
   
   CREATE USER miro_app WITH PASSWORD 'strong_password';
   CREATE DATABASE miro_app_production OWNER miro_app;
   GRANT ALL PRIVILEGES ON DATABASE miro_app_production TO miro_app;
   \q
   ```

3. **アプリケーションのデプロイ**
   ```bash
   # アプリケーションディレクトリ作成
   sudo mkdir -p /var/www/miro-app
   sudo chown $USER:$USER /var/www/miro-app
   cd /var/www/miro-app
   
   # リポジトリクローン
   git clone <your-repo-url> .
   
   # 依存関係インストール
   npm ci --production
   
   # 環境変数設定
   cp .env.production.example .env.production
   nano .env.production  # 実際の値を設定
   
   # ビルド
   npm run build
   
   # マイグレーション
   npx prisma migrate deploy
   npx prisma db seed
   ```

4. **PM2でプロセス管理**
   ```bash
   # PM2インストール
   sudo npm install -g pm2
   
   # アプリケーション起動
   pm2 start npm --name "miro-app" -- start
   
   # 自動起動設定
   pm2 startup
   pm2 save
   ```

5. **Nginx設定**
   ```bash
   sudo nano /etc/nginx/sites-available/miro-app
   ```
   
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       # HTTPSへリダイレクト
       return 301 https://$server_name$request_uri;
   }
   
   server {
       listen 443 ssl http2;
       server_name your-domain.com;
       
       # SSL証明書（Let's Encryptで取得）
       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
       
       # SSL設定
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;
       ssl_prefer_server_ciphers on;
       
       # セキュリティヘッダー
       add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
       add_header X-Frame-Options "DENY" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header X-XSS-Protection "1; mode=block" always;
       
       # Next.jsアプリケーションへプロキシ
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   
   ```bash
   # 設定有効化
   sudo ln -s /etc/nginx/sites-available/miro-app /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. **SSL証明書取得（Let's Encrypt）**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

7. **ファイアウォール設定**
   ```bash
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```

---

## デプロイチェックリスト

### デプロイ前
- [ ] `.env.production` に全ての必須環境変数を設定
- [ ] `npm run generate:secrets` で強力なシークレットキーを生成
- [ ] `NEXT_PUBLIC_APP_URL` がHTTPSで始まることを確認
- [ ] Miro Developer Consoleで本番用アプリケーションを作成
- [ ] データベースが本番環境で準備されている
- [ ] ローカルで `npm run build` が成功することを確認

### デプロイ時
- [ ] 環境変数が正しく設定されている
- [ ] データベースマイグレーションが成功
- [ ] 初期シードデータ（管理者ユーザー）が作成されている
- [ ] ビルドが成功
- [ ] HTTPSが正しく設定されている

### デプロイ後
- [ ] `/api/health` エンドポイントが200を返す
- [ ] `/login` ページにアクセスできる
- [ ] 管理者アカウントでログインできる
- [ ] 画像アップロード機能が動作する
- [ ] Miroボード連携が動作する
- [ ] セキュリティヘッダーが正しく設定されている
- [ ] HTTPS強制リダイレクトが動作する

---

## セキュリティヘッダー確認

デプロイ後、以下のコマンドでセキュリティヘッダーを確認:

```bash
curl -I https://your-domain.com
```

確認項目:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

または、オンラインツールを使用:
- https://securityheaders.com/
- https://observatory.mozilla.org/

---

## トラブルシューティング

### ビルドエラー: 環境変数が見つからない
```
Error: Missing required environment variable: XXX
```

**解決方法**: `.env.production` または ホスティングサービスの環境変数UIで該当変数を設定

### データベース接続エラー
```
Error: Can't reach database server at xxx
```

**解決方法**:
1. `DATABASE_URL` の形式を確認
2. データベースサーバーが起動しているか確認
3. ファイアウォール設定を確認

### HTTPS リダイレクトが動作しない
**解決方法**:
1. `x-forwarded-proto` ヘッダーがプロキシから渡されているか確認
2. Nginxの設定で `proxy_set_header X-Forwarded-Proto $scheme;` が設定されているか確認

### セッションが保持されない
**解決方法**:
1. `SESSION_SECRET` が32文字以上であることを確認
2. Cookieの `secure` 設定がHTTPS環境で有効になっているか確認

---

## ロールバック手順

### Vercel / Railway
- Dashboard → Deployments → 過去のデプロイを選択 → "Redeploy"

### 自社サーバー
```bash
# 前のバージョンに戻す
cd /var/www/miro-app
git checkout <previous-commit-hash>
npm ci --production
npm run build
pm2 restart miro-app

# データベースロールバック（必要な場合）
npx prisma migrate resolve --rolled-back <migration-name>
```

---

## 監視とメンテナンス

### 推奨する監視項目
- ✅ アプリケーションの稼働状況（/api/health）
- ✅ エラーログ
- ✅ データベース接続
- ✅ ディスク使用量
- ✅ CPU/メモリ使用率

### ログ確認

**Vercel**:
```bash
vercel logs
```

**Railway**:
Dashboard → Logs タブ

**自社サーバー**:
```bash
pm2 logs miro-app
```

---

## 参考リンク

- [Next.js デプロイドキュメント](https://nextjs.org/docs/deployment)
- [Vercel ドキュメント](https://vercel.com/docs)
- [Railway ドキュメント](https://docs.railway.app/)
- [Prisma マイグレーション](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)
- [Let's Encrypt](https://letsencrypt.org/)
