-- CreateTable
CREATE TABLE "service_switch" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "university_id" TEXT,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "resume_at" TIMESTAMP(3),
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_switch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_switch_key_idx" ON "service_switch"("key");

-- CreateIndex
CREATE UNIQUE INDEX "service_switch_key_university_id_key" ON "service_switch"("key", "university_id");

-- AddForeignKey
ALTER TABLE "service_switch" ADD CONSTRAINT "service_switch_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
