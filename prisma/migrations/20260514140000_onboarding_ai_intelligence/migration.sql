-- User: extended profile + tracking
ALTER TABLE "users" ADD COLUMN "date_of_birth" TIMESTAMP(3),
ADD COLUMN "bad_habits" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "health_notes" TEXT,
ADD COLUMN "tracking_parameters" JSONB NOT NULL DEFAULT '[]';

-- Replace OnboardingState enum (Postgres: drop old, recreate)
ALTER TABLE "onboarding_sessions" ALTER COLUMN "state" DROP DEFAULT;

ALTER TABLE "onboarding_sessions" ALTER COLUMN "state" SET DATA TYPE TEXT USING (
  CASE "state"::text
    WHEN 'AWAITING_INPUT' THEN 'AWAITING_FOLLOWUP_ANSWERS'
    WHEN 'COMPLETE' THEN 'ONBOARDING_COMPLETED'
    ELSE 'AWAITING_FOLLOWUP_ANSWERS'
  END
);

DROP TYPE "OnboardingState";

CREATE TYPE "OnboardingState" AS ENUM (
  'AWAITING_INITIAL_INTRO',
  'AWAITING_FOLLOWUP_ANSWERS',
  'ONBOARDING_COMPLETED'
);

ALTER TABLE "onboarding_sessions"
ALTER COLUMN "state" SET DATA TYPE "OnboardingState" USING ("state"::"OnboardingState");

ALTER TABLE "onboarding_sessions"
ALTER COLUMN "state" SET DEFAULT 'AWAITING_INITIAL_INTRO'::"OnboardingState";
