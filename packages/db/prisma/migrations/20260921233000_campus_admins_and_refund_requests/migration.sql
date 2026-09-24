-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'failed');

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'campus_admin';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "admin_university_id" TEXT;

-- CreateTable
CREATE TABLE "refund_request" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'pending',
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "failure_detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refund_request_status_created_at_idx" ON "refund_request"("status", "created_at");

-- CreateIndex
CREATE INDEX "refund_request_university_id_status_idx" ON "refund_request"("university_id", "status");

-- CreateIndex
CREATE INDEX "refund_request_order_id_idx" ON "refund_request"("order_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_admin_university_id_fkey" FOREIGN KEY ("admin_university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One open request per order. Two campus admins filing for the same order, or
-- a double-tap, must not queue two refunds for HQ to approve twice.
CREATE UNIQUE INDEX "refund_request_one_pending_per_order"
  ON "refund_request"("order_id") WHERE "status" = 'pending';
