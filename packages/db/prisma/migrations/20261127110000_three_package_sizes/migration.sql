-- Three package sizes (owner 2026-11-27): small, medium, large.
-- ripple -> small, wave -> medium, swell -> large (tide, 150, had no orders).

UPDATE "orders" SET "package_size" = 'small'  WHERE "package_size" = 'ripple';
UPDATE "orders" SET "package_size" = 'medium' WHERE "package_size" = 'wave';
UPDATE "orders" SET "package_size" = 'large'  WHERE "package_size" IN ('swell', 'tide');

-- Carry any price the admin set under the old key to the new one, keeping the
-- admin's value; where no row exists the app's built-in default (50/60/70) applies.
INSERT INTO "platform_config" ("key", "value", "updated_at")
SELECT 'size_price_small', "value", now() FROM "platform_config" WHERE "key" = 'size_price_ripple'
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "platform_config" ("key", "value", "updated_at")
SELECT 'size_price_medium', "value", now() FROM "platform_config" WHERE "key" = 'size_price_wave'
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "platform_config" ("key", "value", "updated_at")
SELECT 'size_price_large', "value", now() FROM "platform_config" WHERE "key" = 'size_price_swell'
ON CONFLICT ("key") DO NOTHING;

DELETE FROM "platform_config" WHERE "key" IN ('size_price_ripple', 'size_price_wave', 'size_price_swell', 'size_price_tide');
