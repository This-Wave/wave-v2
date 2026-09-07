-- CreateTable
CREATE TABLE "reminder_log" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_log_profile_id_sent_at_idx" ON "reminder_log"("profile_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_log_profile_id_kind_dedupe_key_key" ON "reminder_log"("profile_id", "kind", "dedupe_key");

-- AddForeignKey
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
