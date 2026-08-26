-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'blocked', 'done');

-- CreateTable
CREATE TABLE "note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL DEFAULT '',
    "project_id" TEXT,
    "exclude_from_rag" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_link" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT,
    "target_title_raw" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_tag" (
    "noteId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "note_tag_pkey" PRIMARY KEY ("noteId","tag")
);

-- CreateTable
CREATE TABLE "note_chunk" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "embedding_json" TEXT,
    "exclude_from_rag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dettct_run" (
    "id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "total_techniques" INTEGER NOT NULL,
    "covered_count" INTEGER NOT NULL,

    CONSTRAINT "dettct_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "task_type" TEXT,
    "assignee_id" TEXT,
    "due_date" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_title_idx" ON "note"("title");

-- CreateIndex
CREATE INDEX "note_link_source_id_idx" ON "note_link"("source_id");

-- CreateIndex
CREATE INDEX "note_link_target_id_idx" ON "note_link"("target_id");

-- CreateIndex
CREATE INDEX "note_chunk_note_id_idx" ON "note_chunk"("note_id");

-- CreateIndex
CREATE INDEX "task_project_id_status_idx" ON "task"("project_id", "status");

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_link" ADD CONSTRAINT "note_link_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_link" ADD CONSTRAINT "note_link_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_tag" ADD CONSTRAINT "note_tag_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_chunk" ADD CONSTRAINT "note_chunk_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

