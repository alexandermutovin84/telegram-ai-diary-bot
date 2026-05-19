-- AlterEnum
ALTER TYPE "DiarySessionState" ADD VALUE 'AWAITING_DIARY_BLITZ';

-- AlterTable
ALTER TABLE "diary_entries" ADD COLUMN "missing_parameters_json" JSONB NOT NULL DEFAULT '[]';
