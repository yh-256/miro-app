# Miro Image Upload App

スマートフォンやPCからWebアプリにアクセスし、画像を指定したMiroボードへ直接アップロード・配置できるアプリケーション。ユーザー認証は不要で、誰でもアクセス可能。画像には撮影者や個人IDなどのメタデータを付与し、Miroボード上で直感的に整理・識別・グループ化できます。

## 🎯 プロジェクト状況

- 🚧 **実装完成度**: コアフローは動作するが一部機能は未実装・改善予定
- ✅ **TypeScriptエラー**: 0件（現状）
- ✅ **ESLintエラー・警告**: 0件  
- ⚠️ **Production Ready**: 本番運用前提では未完成（ローカルストレージ依存など改善予定）

## 📋 主要機能

### 1. 画像アップロード機能
- **カメラ撮影**: スマートフォンカメラでの直接撮影
- **ファイル選択**: PCからのファイル選択・ドラッグ&ドロップ
- **複数画像対応**: 一度に複数の画像をアップロード
- **プレビュー機能**: アップロード前の画像確認・編集

### 2. メタデータ管理
- **個人ID管理**: 個人IDの新規作成・選択機能（現在はブラウザの`localStorage`に保存）
- **アップロード者情報**: 撮影者名の任意入力
- **セッション管理**: UI上でセッションIDを付与（サーバー永続化は未実装）
- **自動メタデータ**: アップロード日時・ファイル名の表示
- 🔜 **サーバー永続化**: Supabase等の外部DBへデータを保存する計画あり

### 3. Miroボード連携
- **自動配置**: 画像とメタデータ付箋の自動配置
- **個人ID別グループ化**: 画像と付箋をグループとしてまとめる
- 📝 **フレーム作成**: 個人ID別フレーム作成は未実装（今後の改善予定）
- **ボード選択**: アップロード先ボードの選択機能

### 4. 検索・閲覧機能
- **検索フォーム**: キーワード・個人ID・アップロード者での検索UI
- ⚠️ **実装制限**: 現状はMiro APIから最大50件を取得しローカルでフィルタしているため、大規模ボードでは結果が欠落する可能性あり（ページング対応を改善予定）
- **詳細検索UI**: 日付range・アイテムタイプの入力欄を提供（Miro API制限により完全反映は今後の課題）
- **ボード表示**: Miroボードの埋め込み表示・直接リンク
- **レスポンシブ対応**: スマートフォン・PC・タブレット対応

### 5. セキュリティ機能
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

## 📁 プロジェクト構成

```
miro-app/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API Routes
│   │   │   ├── boards/     # ボード関連API
│   │   │   ├── subjects/   # 個人ID管理API（現在はlocalStorage依存）
│   │   │   ├── upload/     # アップロードAPI
│   │   │   └── search/     # 検索API（最大50件まで取得）
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

### 2. 依存関係のインストール
```bash
npm install
# または
yarn install
```

### 3. 環境変数の設定
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
```

### 4. 開発サーバー起動
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

- Supabaseなど外部データベースへの移行（個人ID・アップロード履歴の永続化）
- Miro API検索のページング対応と結果精度向上
- 個人IDごとのフレーム自動生成やレイアウト最適化
- 暗号化ユーティリティの本格導入とSecrets管理強化

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
