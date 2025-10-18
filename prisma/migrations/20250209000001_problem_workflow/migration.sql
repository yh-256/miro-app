-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'INSIGHT_WRITTEN', 'BOARD_VIEWED', 'COMPLETED');

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL,
    "miro_board_id" TEXT,
    "content_type" TEXT NOT NULL DEFAULT 'text',
    "content_body" TEXT,
    "content_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_progress" (
    "id" TEXT NOT NULL,
    "problem_id" TEXT NOT NULL,
    "user_session_id" TEXT NOT NULL,
    "status" "ProblemStatus" NOT NULL DEFAULT 'LOCKED',
    "insight_submitted_at" TIMESTAMP(3),
    "board_unlocked_at" TIMESTAMP(3),
    "board_viewed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problem_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "problem_id" TEXT NOT NULL,
    "user_session_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_token_key" ON "user_sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "problems_order_index_key" ON "problems"("order_index");

-- CreateIndex
CREATE UNIQUE INDEX "problem_progress_problem_id_user_session_id_key" ON "problem_progress"("problem_id", "user_session_id");

-- CreateIndex
CREATE INDEX "problem_progress_user_session_id_idx" ON "problem_progress"("user_session_id");

-- CreateIndex
CREATE INDEX "insights_problem_id_idx" ON "insights"("problem_id");

-- CreateIndex
CREATE INDEX "insights_user_session_id_idx" ON "insights"("user_session_id");

-- AlterTable
ALTER TABLE "upload_sessions"
    ADD COLUMN "problem_id" TEXT,
    ADD COLUMN "user_session_id" TEXT;

-- AlterTable
ALTER TABLE "uploaded_items"
    ADD COLUMN "problem_id" TEXT,
    ADD COLUMN "user_session_id" TEXT;

-- CreateIndex
CREATE INDEX "upload_sessions_problem_id_idx" ON "upload_sessions"("problem_id");

-- CreateIndex
CREATE INDEX "upload_sessions_user_session_id_idx" ON "upload_sessions"("user_session_id");

-- CreateIndex
CREATE INDEX "uploaded_items_problem_id_idx" ON "uploaded_items"("problem_id");

-- CreateIndex
CREATE INDEX "uploaded_items_user_session_id_idx" ON "uploaded_items"("user_session_id");

-- AddForeignKey
ALTER TABLE "problem_progress"
    ADD CONSTRAINT "problem_progress_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_progress"
    ADD CONSTRAINT "problem_progress_user_session_id_fkey" FOREIGN KEY ("user_session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights"
    ADD CONSTRAINT "insights_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights"
    ADD CONSTRAINT "insights_user_session_id_fkey" FOREIGN KEY ("user_session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_sessions"
    ADD CONSTRAINT "upload_sessions_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_sessions"
    ADD CONSTRAINT "upload_sessions_user_session_id_fkey" FOREIGN KEY ("user_session_id") REFERENCES "user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_items"
    ADD CONSTRAINT "uploaded_items_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_items"
    ADD CONSTRAINT "uploaded_items_user_session_id_fkey" FOREIGN KEY ("user_session_id") REFERENCES "user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
