-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_sessions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "uploader_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_items" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "subject_id" TEXT,
    "miro_image_id" TEXT NOT NULL,
    "miro_sticky_id" TEXT NOT NULL,
    "miro_group_id" TEXT,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploaded_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "upload_sessions_session_id_key" ON "upload_sessions"("session_id");

-- CreateIndex
CREATE INDEX "upload_sessions_board_id_idx" ON "upload_sessions"("board_id");

-- CreateIndex
CREATE INDEX "uploaded_items_subject_id_idx" ON "uploaded_items"("subject_id");

-- CreateIndex
CREATE INDEX "uploaded_items_session_id_idx" ON "uploaded_items"("session_id");

-- AddForeignKey
ALTER TABLE "uploaded_items" ADD CONSTRAINT "uploaded_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "upload_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_items" ADD CONSTRAINT "uploaded_items_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
