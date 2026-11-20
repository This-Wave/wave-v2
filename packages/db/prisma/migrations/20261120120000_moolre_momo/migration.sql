-- Moolre Mobile Money: who paid, on which network, so a refund can be paid back.
-- Additive only: existing Paystack orders are untouched.
ALTER TABLE "orders" ADD COLUMN "momo_payer" TEXT;
ALTER TABLE "orders" ADD COLUMN "momo_network" TEXT;
ALTER TABLE "orders" ADD COLUMN "goods_momo_payer" TEXT;
ALTER TABLE "orders" ADD COLUMN "goods_momo_network" TEXT;
