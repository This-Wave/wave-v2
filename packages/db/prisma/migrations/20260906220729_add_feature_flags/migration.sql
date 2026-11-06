-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_origin_checkpoint_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_shop_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_suggestion_id_fkey";

-- DropIndex
DROP INDEX "orders_order_type_idx";

-- CreateTable
CREATE TABLE "feature_flag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "university_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feature_flag_key_idx" ON "feature_flag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flag_key_university_id_key" ON "feature_flag"("key", "university_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_origin_checkpoint_id_fkey" FOREIGN KEY ("origin_checkpoint_id") REFERENCES "checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "shop_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag" ADD CONSTRAINT "feature_flag_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
