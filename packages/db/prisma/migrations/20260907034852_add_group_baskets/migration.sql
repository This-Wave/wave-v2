-- CreateEnum
CREATE TYPE "GroupBasketStatus" AS ENUM ('open', 'locked', 'converted', 'expired');

-- CreateTable
CREATE TABLE "group_basket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "starter_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "is_special_order" BOOLEAN NOT NULL DEFAULT false,
    "status" "GroupBasketStatus" NOT NULL DEFAULT 'open',
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_basket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_basket_item" (
    "id" TEXT NOT NULL,
    "basket_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "unit_price" DECIMAL(10,2),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_basket_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_basket_code_key" ON "group_basket"("code");

-- CreateIndex
CREATE UNIQUE INDEX "group_basket_order_id_key" ON "group_basket"("order_id");

-- CreateIndex
CREATE INDEX "group_basket_status_scheduled_date_idx" ON "group_basket"("status", "scheduled_date");

-- CreateIndex
CREATE INDEX "group_basket_item_basket_id_idx" ON "group_basket_item"("basket_id");

-- AddForeignKey
ALTER TABLE "group_basket" ADD CONSTRAINT "group_basket_starter_id_fkey" FOREIGN KEY ("starter_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_basket" ADD CONSTRAINT "group_basket_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_basket" ADD CONSTRAINT "group_basket_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_basket" ADD CONSTRAINT "group_basket_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_basket_item" ADD CONSTRAINT "group_basket_item_basket_id_fkey" FOREIGN KEY ("basket_id") REFERENCES "group_basket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_basket_item" ADD CONSTRAINT "group_basket_item_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
