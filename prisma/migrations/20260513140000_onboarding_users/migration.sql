-- CreateEnum
CREATE TYPE "OnboardingState" AS ENUM ('AWAITING_INPUT', 'COMPLETE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferred_name" TEXT,
    "gender" TEXT,
    "age" INTEGER,
    "height_cm" INTEGER,
    "weight_kg" DOUBLE PRECISION,
    "occupation" TEXT,
    "diary_goals" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateTable
CREATE TABLE "onboarding_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "state" "OnboardingState" NOT NULL DEFAULT 'AWAITING_INPUT',
    "last_follow_up" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboarding_sessions_user_id_key" ON "onboarding_sessions"("user_id");

ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE IF EXISTS "SchemaBootstrap";
