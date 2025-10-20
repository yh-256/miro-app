# Miro Image Upload App

スマートフォンやPCからWebアプリにアクセスし、画像を指定したMiroボードへ直接アップロード・配置できるアプリケーション。ユーザー認証は不要で、誰でもアクセス可能。画像には撮影者や個人IDなどのメタデータを付与し、Miroボード上で直感的に整理・識別・グループ化できます。

## 🎯 プロジェクト状況

- ✅ **実装完成度**: 問題ステップの気づき投稿 → ボード閲覧 → 画像アップロード → 検索までの一連フローを実装（ページングや履歴UIは今後の予定）
- ✅ **TypeScriptエラー**: 0件（現状）
- ✅ **ESLintエラー・警告**: 0件  
- ⚠️ **Production Ready**: 本番運用前提では未完成（検索件数制限・セキュリティ強化など改善予定）

## 📋 主要機能

### 1. 画像アップロード機能
- **カメラ撮影**: スマートフォンカメラでの直接撮影
- **ファイル選択**: PCからのファイル選択・ドラッグ&ドロップ
- **複数画像対応**: 一度に複数の画像をアップロード
- **プレビュー機能**: アップロード前の画像確認・編集

### 2. メタデータ管理
- **個人ID管理**: 個人IDの新規作成・選択機能（PostgreSQLに永続化）
- **アップロード者情報**: 撮影者名の任意入力
- **セッション管理**: アップロードセッションをDBに保存し、検索結果に活用
- **自動メタデータ**: アップロード日時・ファイル名・ファイルサイズなどを記録
- 🔜 **管理UI強化**: セッション履歴画面や編集機能は今後実装予定

### 3. Miroボード連携
- **自動配置**: 画像とメタデータ付箋の自動配置
- **個人ID別グループ化**: 画像と付箋をグループとしてまとめる
- 📝 **フレーム作成**: 個人ID別フレーム作成は未実装（今後の改善予定）
- **ボード選択**: アップロード先ボードの選択機能

### 4. 問題単位の学習フロー
- **問題一覧 (`/problems`)**: ステップ順・進捗状況・統計をカード表示
- **問題詳細 (`/problems/[problemId]`)**: 気づき投稿、進捗更新、ボード閲覧、問題コンテキストの画像アップロードを統合
- **閲覧ガード**: 気づき投稿前はボード/アップロードがロックされ、投稿後に解禁
- **問題コンテキストアップロード (`/upload?problemId=...`)**: 一般アップロードを問題ID付きで再利用

### 5. 検索・閲覧機能
- **検索フォーム**: キーワード・個人ID・アップロード者での検索UI
- ⚠️ **実装制限**: Miro APIから最大50件を取得しローカルでフィルタしているため、大規模ボードでは結果が欠落する可能性あり（ページング対応を改善予定）
- **DB連携メタデータ**: 検索結果にファイルサイズ・MIMEタイプ・セッション情報・問題IDなどDB由来の情報を付与
- **閲覧権フィルタ**: 気づきを投稿済みの問題のみ検索結果に表示し、除外件数をユーザーへ通知
- **詳細検索UI**: 日付range・アイテムタイプの入力欄を提供（Miro API制限により完全反映は今後の課題）
- **ボード表示**: Miroボードの埋め込み表示・直接リンク
- **レスポンシブ対応**: スマートフォン・PC・タブレット対応

### 6. セキュリティ機能
- **ファイル検証**: 形式・サイズを簡易チェック
- **一時ファイル管理**: アップロード後の自動削除
- **CORS対応**: ミドルウェアで制限
- **環境変数バリデーション**: 厳格な環境変数チェックを実装
- 🔜 **機密情報暗号化**: 暗号化ユーティリティは用意済みだが未適用（今後適用予定）

## 🛠 技術スタック

- **フロントエンド**: React 19.1.0, Next.js 15.4.4 (App Router)
- **言語**: TypeScript 5
- **スタイリング**: Tailwind CSS 4
- **外部API**: Miro REST API v2
- **開発ツール**: ESLint, Jest, Testing Library
- **デプロイ**: Vercel対応

## 🧰 主要技術の解説

- **Next.js 15 / React 19**  
  App Router構成でクライアント・サーバーコンポーネントを併用。画像アップロードや検索UIなどはクライアントコンポーネント、API RouteでMiro連携処理を実装。

- **TypeScript**  
  `src/types` を中心に型定義を管理。APIレスポンスやアップロードデータなどのドメイン型を共有し、型安全なフロント・バック間連携を実現。

- **Tailwind CSS 4**  
  ユーティリティクラスでレスポンシブなUIを構築。`globals.css` で基本設定を行い、コンポーネント単位でスタイルを適用。

- **Miro REST API v2**  
  `src/utils/miroClient.ts` でAPIクライアントを実装。画像アップロード・付箋作成・アイテム検索などを行い、ボード上のレイアウトもMiro API経由で調整。

- **ファイルアップロード周り（Formidable / Node File API）**  
  API Routeで送られてきたBase64画像を一時ファイルに保存し、Miroへ転送。`fileValidation.ts` で簡易的なサイズ・形式チェックを実施し、完了後にDBへ記録。

- **PostgreSQL + Prisma**  
  ローカルPostgreSQLに接続し、Prismaでスキーマを管理。`subjects` / `upload_sessions` / `uploaded_items` テーブルを通じて個人IDやアップロード履歴を永続化し、検索にも活用。

- **ミドルウェア / セキュリティ対策**  
  `middleware.ts` でCORSやレート制限、セキュリティヘッダーを付与。`utils/config.ts` で環境変数の厳格なバリデーションを行う。

- **テストツール（Jest + Testing Library）**  
  主要コンポーネント・ユーティリティの単体テストを想定した設定を準備。E2Eテストは未整備だが、将来Playwright等の導入を想定。

## 📁 プロジェクト構成

```
miro-app/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API Routes
│   │   │   ├── boards/     # ボード関連API
│   │   │   ├── subjects/   # 個人ID管理API（PostgreSQL + Prisma）
│   │   │   ├── upload/     # アップロードAPI（アップロード結果をDBに保存）
│   │   │   └── search/     # 検索API（Miro APIとDBを組み合わせてメタデータを返却）
│   │   ├── board/          # ボード表示ページ
│   │   ├── search/         # 検索ページ  
│   │   └── upload/         # アップロードページ
│   ├── components/         # Reactコンポーネント
│   │   ├── ImageCapture.tsx      # 画像キャプチャ
│   │   ├── MetadataForm.tsx      # メタデータ入力
│   │   ├── BoardSelector.tsx     # ボード選択
│   │   ├── UploadProgress.tsx    # アップロード進捗
│   │   ├── SearchForm.tsx        # 検索フォーム
│   │   ├── SearchResults.tsx     # 検索結果表示
│   │   └── BoardEmbed.tsx        # ボード埋め込み
│   ├── utils/              # ユーティリティ関数
│   │   ├── miroClient.ts         # Miro APIクライアント
│   │   ├── uploadService.ts      # アップロードサービス
│   │   ├── searchService.ts      # 検索サービス
│   │   ├── errorHandler.ts       # エラーハンドリング
│   │   ├── fileValidation.ts     # ファイル検証
│   │   └── config.ts            # 設定管理
│   └── types/              # TypeScript型定義
└── public/                 # 静的ファイル
```

## 🚀 セットアップ

### 1. 必要な環境
- Node.js 18.17以上
- npm, yarn, pnpm, または bun

### 2. データベースの準備
- ローカルに PostgreSQL をインストールし、開発用データベースとユーザーを作成
  ```bash
  createdb miro_app_dev
  # 例: psql -c "CREATE USER miro_app WITH PASSWORD 'password';"
  ```
- `.env.local` の `DATABASE_URL` をローカル環境に合わせて設定
  ```
  DATABASE_URL=postgres://ユーザー:パスワード@localhost:5432/miro_app_dev
  ```
- Prisma クライアントを生成
  ```bash
  npm run prisma:generate
  ```
- マイグレーションを適用  
  ```bash
  npm run prisma:migrate
  ```
  ※ 権限エラーが出る場合は `ALTER ROLE miro_app CREATEDB;` などで shadow DB 作成権限を付与してください。

### 3. 依存関係のインストール
```bash
npm install
# または
yarn install
```

### 4. 環境変数の設定
`.env.local`ファイルを作成し、以下の環境変数を設定：

```bash
# Miro API設定
MIRO_CLIENT_ID=your_miro_client_id
MIRO_CLIENT_SECRET=your_miro_client_secret
MIRO_ACCESS_TOKEN=your_miro_access_token
MIRO_REFRESH_TOKEN=your_miro_refresh_token

# アプリケーション設定
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# セキュリティ設定
ENCRYPTION_KEY=your_32_character_encryption_key
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# アップロード設定
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif
TEMP_DIRECTORY=/tmp
CLEANUP_INTERVAL=3600000

# セキュリティオプション
TOKEN_EXPIRATION_CHECK=true
RUNTIME_VALIDATION=true
SECRET_ROTATION_INTERVAL=2592000000

# データベース設定
DATABASE_URL=postgres://postgres:postgres@localhost:5432/miro_app_dev
```

### 5. 開発サーバー起動
```bash
npm run dev
# または
yarn dev
# または
pnpm dev
# または
bun dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセス

## 📱 使用方法

### 1. 画像アップロード
1. トップページで「画像アップロード」を選択
2. カメラ撮影またはファイル選択で画像を追加
3. 各画像に個人IDを設定
4. 送信先Miroボードを選択
5. アップロード実行

### 2. ボード表示・検索
1. トップページで「ボード表示」を選択
2. 表示したいMiroボードを選択
3. 検索機能で特定の画像を検索
4. Miroで直接編集も可能

### 3. 個人ID管理
- 新規個人IDの作成・管理
- 使用頻度による自動ソート
- 重複チェック機能

## 🗃 データベース設計

```mermaid
erDiagram
  Subject {
    String id PK
    String name
    Date created_at
    Date last_used_at
  }

  UploadSession {
    String id PK
    String session_id
    String board_id
    String uploader_name
    Date created_at
  }

  UploadedItem {
    String id PK
    String session_id FK
    String subject_id FK
    String miro_image_id
    String miro_sticky_id
    String miro_group_id
    String file_name
    Int    file_size
    String mime_type
    Int    image_width
    Int    image_height
    Float  position_x
    Float  position_y
    Date   created_at
    Date   updated_at
  }

  Subject ||--o{ UploadedItem : "uploads"
  UploadSession ||--o{ UploadedItem : "items"
```

- **subjects**: 個人IDを管理。`last_used_at` を更新することで頻出順ソートに利用。
- **upload_sessions**: 1回のアップロード処理を表すレコード。MiroボードID・送信者名を保持。
- **uploaded_items**: アップロードされた各画像／付箋を保存。MiroアイテムIDやファイル情報を検索時に利用。

## 🔌 API仕様

### ボード一覧取得
```typescript
GET /api/boards/list

Response: {
  boards: Array<{
    id: string;
    name: string;
    description?: string;
    thumbnailUrl?: string;
  }>
}
```

### 画像アップロード
```typescript
POST /api/upload/images

Request: {
  images: File[];
  boardId: string;
  metadata: Array<{
    subjectId: string;
    uploaderName?: string;
    sessionId: string;
  }>;
}

Response: {
  success: boolean;
  uploadedItems: Array<{
    imageId: string;
    stickyNoteId: string;
    groupId: string;
  }>;
}
```

### 検索
```typescript
GET/POST /api/search

Parameters: {
  boardId: string;
  query?: string;
  searchType?: 'general' | 'subject' | 'uploader';
  subjectId?: string;
  uploaderName?: string;
  dateFrom?: string;
  dateTo?: string;
  itemTypes?: string[];
  limit?: number;
}

Response（一部）: {
  success: boolean;
  results: {
    items: Array<{
      id: string;
      type: 'image' | 'sticky_note' | 'group';
      metadata?: {
        subjectId?: string;
        subjectName?: string;
        uploaderName?: string;
        uploadedAt?: string;
        fileName?: string;
        sessionId?: string;
        fileSize?: number;
        mimeType?: string;
      };
      // ...
    }>;
    totalCount: number;
    hasMore: boolean;
  };
}
```

## 🧪 開発・テスト

### コード品質チェック
```bash
# TypeScript型チェック
npm run type-check

# ESLintチェック
npm run lint

# ESLint自動修正
npm run lint:fix
```

### テスト実行
```bash
# 単体テスト
npm run test

# テストカバレッジ
npm run test:coverage

# （E2Eテストは未整備）
# npm run test:e2e
```

### ビルド
```bash
# 本番ビルド
npm run build

# ビルド結果の確認
npm run start
```

## 🌐 デプロイ

### Vercelデプロイ
1. Vercelプロジェクト作成
2. 環境変数の設定（Vercel dashboard）
3. GitHubリポジトリ連携で自動デプロイ

### 環境変数（本番）
本番環境では以下を必ず設定：
- `MIRO_ACCESS_TOKEN`: 有効なMiro APIトークン
- `NEXTAUTH_SECRET`: 32文字以上のランダム文字列
- `ENCRYPTION_KEY`: 32文字以上の暗号化キー
- `ALLOWED_ORIGINS`: 本番ドメインのみ許可

## 🔒 セキュリティ

### 実装済みセキュリティ機能
- **CORS設定**: 適切なオリジン制限
- **ファイル検証**: MIME type・拡張子・サイズチェック
- **環境変数チェック**: 厳格な必須変数検証
- **一時ファイル管理**: アップロード後の自動削除
- **レート制限**: API呼び出し制限
- **CSPヘッダー**: Content Security Policy適用

### セキュリティベストプラクティス
- 本番環境では必ずHTTPS使用
- 定期的なアクセストークンの更新
- ログ出力時の個人情報マスキング
- 適切なCORS設定の維持

## 🔜 今後の予定

- 検索APIのページング対応と、大規模ボード対応の強化
- アップロード履歴ビューや管理UIの追加
- 暗号化ユーティリティの本格導入とSecrets管理強化
- Prisma/DB を利用した統合テストとCI整備

## 📊 システム要件

### パフォーマンス目標
- **画像アップロード**: 5MB画像で30秒以内
- **ボード表示**: 初回読み込み5秒以内
- **同時アップロード**: 10ユーザー同時対応

### ブラウザサポート
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- モバイルブラウザ対応

## 🤝 コントリビューション

### 開発ガイドライン
1. TypeScript strictモード準拠
2. ESLint設定に従ったコード記述
3. 適切なエラーハンドリング実装
4. レスポンシブデザイン対応
5. テストコード作成

### コミット規約
```
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
test: テスト追加・修正
docs: ドキュメント更新
```

<!-- ## 📞 サポート

### 問題報告
- バグ報告: GitHubのIssuesを使用
- 機能要望: Discussionsで議論
- セキュリティ問題: 非公開で報告

### 開発者情報
- **プロジェクト状況**: Production Ready
- **保守性**: 高（TypeScriptエラー0件、ESLint警告0件）
- **拡張性**: 高（モジュラー設計、適切な抽象化）

## 📜 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

---

## 📈 プロジェクト実績

- **実装完成度**: 100%（全7要件完全実装）
- **コード品質**: エンタープライズレベル
- **セキュリティ**: 包括的な対策実装
- **パフォーマンス**: Next.js最適化機能フル活用
- **保守性**: 詳細なドキュメント・型定義完備

**最終更新**: プロジェクト完成時点  
**メンテナンス状況**: アクティブ -->
