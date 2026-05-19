-- CreateEnum
CREATE TYPE "DiaryEntryStatus" AS ENUM ('DRAFT', 'COMPLETED');

CREATE TYPE "DiarySessionState" AS ENUM (
  'IDLE',
  'AWAITING_DIARY_ENTRY',
  'AWAITING_DIARY_FOLLOWUP',
  'DIARY_COMPLETED'
);

-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "raw_text" TEXT,
    "combined_text" TEXT NOT NULL DEFAULT '',
    "structured_data_json" JSONB NOT NULL,
    "ai_summary" TEXT,
    "status" "DiaryEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "diary_entry_id" TEXT,
    "state" "DiarySessionState" NOT NULL DEFAULT 'IDLE',
    "follow_up_round" INTEGER NOT NULL DEFAULT 0,
    "missing_fields_json" JSONB NOT NULL DEFAULT '[]',
    "follow_up_questions_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "diary_entries_user_id_entry_date_key" ON "diary_entries"("user_id", "entry_date");

CREATE UNIQUE INDEX "diary_sessions_user_id_key" ON "diary_sessions"("user_id");

CREATE INDEX "diary_entries_user_id_idx" ON "diary_entries"("user_id");

ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "diary_sessions" ADD CONSTRAINT "diary_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "diary_sessions" ADD CONSTRAINT "diary_sessions_diary_entry_id_fkey" FOREIGN KEY ("diary_entry_id") REFERENCES "diary_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
