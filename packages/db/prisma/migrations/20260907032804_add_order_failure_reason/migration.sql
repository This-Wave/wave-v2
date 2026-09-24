-- CreateEnum
CREATE TYPE "OrderFailureReason" AS ENUM ('abandoned_payment', 'student_cancelled', 'shop_rejected', 'admin_refunded', 'out_of_stock', 'no_rider');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "failure_reason" "OrderFailureReason";
