-- CreateEnum
CREATE TYPE "FlagState" AS ENUM ('off', 'beta', 'on');

-- CreateEnum
CREATE TYPE "BetaStatus" AS ENUM ('pending', 'approved', 'rejected', 'revoked');

-- feature_flag.enabled (boolean) -> feature_flag.state (off | beta | on).
-- Carried over rather than dropped and re-added: a flag someone switched on
-- must still be on after this deploys.
ALTER TABLE "feature_flag" ADD COLUMN "state" "FlagState" NOT NULL DEFAULT 'off';
UPDATE "feature_flag" SET "state" = CASE WHEN "enabled" THEN 'on'::"FlagState" ELSE 'off'::"FlagState" END;
ALTER TABLE "feature_flag" DROP COLUMN "enabled";

-- CreateTable
CREATE TABLE "beta_application" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "status" "BetaStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "review_note" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beta_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beta_feedback" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "screen" TEXT,
    "app_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beta_application_profile_id_key" ON "beta_application"("profile_id");

-- CreateIndex
CREATE INDEX "beta_application_status_created_at_idx" ON "beta_application"("status", "created_at");

-- CreateIndex
CREATE INDEX "beta_feedback_created_at_idx" ON "beta_feedback"("created_at");

-- AddForeignKey
ALTER TABLE "beta_application" ADD CONSTRAINT "beta_application_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
