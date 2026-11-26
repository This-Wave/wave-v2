-- CreateEnum
CREATE TYPE "BusinessLeadKind" AS ENUM ('bulk_pickup', 'shop_listing');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "pwa_installed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "guest_visits" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "university_id" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_leads" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "university_id" TEXT,
    "kind" "BusinessLeadKind" NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_messages" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL,
    "delivered" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "sent_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_visits_created_at_idx" ON "guest_visits"("created_at");

-- CreateIndex
CREATE INDEX "business_leads_created_at_idx" ON "business_leads"("created_at");

-- CreateIndex
CREATE INDEX "admin_messages_created_at_idx" ON "admin_messages"("created_at");

