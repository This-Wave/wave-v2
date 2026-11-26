-- First-order promo code (HELLOHILL at launch, 27 Nov 2026).
ALTER TABLE "orders" ADD COLUMN "promo_code" TEXT;

-- 25% off the first delivery fee; set to 0 in admin Config to switch it off.
INSERT INTO "platform_config" ("key", "value", "description", "updated_at")
VALUES ('promo_first_order_pct', '25', 'First-order code discount on the delivery fee (%). 0 turns the code off.', NOW())
ON CONFLICT ("key") DO NOTHING;
