# Miro Collaborative Learning Board

授業・ワークショップで参加者が投稿する「気づき」や画像を、問題単位でMiroボードへ集約・整理するためのWebアプリケーションです。

スマートフォン/PCからの画像投稿、Miro REST APIを使った自動配置、PostgreSQLへのメタデータ保存、問題ごとの進捗管理、検索までをNext.jsアプリとしてまとめています。

## What this project demonstrates

- Next.js App Routerを使ったフルスタックWebアプリ開発
- Miro REST APIとの外部サービス連携
- PostgreSQL + Prismaによる永続化とマイグレーション管理
- 画像アップロード・検証・リサイズ・一時ファイル管理
- 問題単位の学習フローと閲覧制御
- iron-sessionを使ったログイン/セッション管理
- CORS、CSP、レート制限、環境変数検証などのWebセキュリティ対策
- Jest / Testing Library / TypeScript / ESLintを使った品質管理

## User flow

```mermaid
flowchart LR
    Login[Login] --> Problems[Problem list]
    Problems --> Insight[Submit insight]
    Insight --> Board[View Miro board]
    Board --> Upload[Upload images]
    Upload --> Miro[Miro REST API]
    Upload --> DB[(PostgreSQL)]
    DB --> Search[Search / browse]
    Miro --> Search
```

1. ユーザがログイン
2. 問題一覧から対象の問題を選択
3. 問題に対する「気づき」を投稿
4. 投稿後にMiroボード閲覧・画像アップロードを利用
5. 画像とメタデータをMiroとDBへ保存
6. 問題・ユーザ・投稿者などの条件で検索

## Main features

### Problem-oriented workflow

- 問題一覧と進捗状態を表示
- 問題詳細で気づきを投稿
- 気づき投稿前後でボード閲覧/アップロード可否を制御
- 問題IDを画像アップロードと検索メタデータに連携

### Image upload

- スマートフォンカメラ / ファイル選択
- 複数画像アップロード
- アップロード前プレビュー
- MIME type / 拡張子 / サイズ検証
- Sharpを利用した画像処理
- Miro上へ画像と付箋を配置・グループ化

### Search

- キーワード検索
- ユーザID / 投稿者による絞り込み
- DBに保存したファイル情報・セッション情報・問題IDを結果へ付与
- 閲覧可能な問題に応じた検索結果フィルタ

> **Known limitation:** Miro APIから取得したアイテムをローカルでフィルタする処理があり、大規模ボード向けページングは今後の改善対象です。

## Architecture

```mermaid
flowchart TB
    Browser[Browser / Mobile] --> Next[Next.js App Router]
    Next --> Auth[iron-session]
    Next --> API[API Routes]
    API --> Miro[Miro REST API v2]
    API --> Prisma[Prisma]
    Prisma --> Postgres[(PostgreSQL)]
    API --> Files[Image validation / processing]
```

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19 / Next.js 15 / TypeScript |
| Styling | Tailwind CSS 4 |
| External API | Miro REST API v2 |
| Database | PostgreSQL / Prisma |
| Session | iron-session |
| Image processing | Sharp |
| Testing | Jest / Testing Library |
| Quality | ESLint / Prettier / Knip |

## Repository structure

```text
.
├── prisma/
│   ├── migrations/         # DB migration history
│   ├── scripts/            # backup / restore / migration checks
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── api/            # auth / boards / problems / upload / search
│   │   ├── problems/       # problem workflow
│   │   ├── upload/
│   │   ├── search/
│   │   └── board/
│   ├── components/
│   ├── lib/                # auth / Prisma / session
│   ├── types/
│   └── utils/              # Miro, upload, validation, search, security
└── docs/                   # database / deployment / environment docs
```

## Local setup

### Prerequisites

- Node.js 18.17+
- PostgreSQL
- pnpm
- Miro API credentials

### Install

```bash
pnpm install
```

### Database

```bash
createdb miro_app_dev
pnpm prisma:generate
pnpm prisma:migrate
```

### Environment variables

Create `.env.local`.

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/miro_app_dev

MIRO_CLIENT_ID=your_miro_client_id
MIRO_CLIENT_SECRET=your_miro_client_secret
MIRO_ACCESS_TOKEN=your_miro_access_token
MIRO_REFRESH_TOKEN=your_miro_refresh_token

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=replace_with_a_random_secret
SESSION_SECRET=replace_with_at_least_32_characters

# Required for production security checks
ENCRYPTION_KEY=replace_with_at_least_32_characters

ALLOWED_ORIGINS=http://localhost:3000
```

### Run

```bash
pnpm dev
```

Open http://localhost:3000.

## Quality checks

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm knip
pnpm build
```

## Security notes

The application includes:

- API route CORS checks
- rate limiting
- security headers / CSP
- HTTPS enforcement in production
- upload file validation
- server-side environment validation
- session-secret validation

The in-memory rate-limit store is suitable for the current application architecture but would need an external shared store such as Redis when scaling across multiple server instances.

## Documentation

- [docs/DATABASE.md](docs/DATABASE.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)

## Current status

The core flow — login, problem selection, insight submission, Miro board access, image upload, persistence, and search — is implemented.

Current improvement targets include Miro item pagination for large boards, richer upload-history/admin views, integration testing around PostgreSQL/Prisma, and CI automation.
