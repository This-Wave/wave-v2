-- Four sizes again (owner 2026-11-27), prices +10: Ripple 60, Wave 70, Swell 80, Tide 160.
-- Reverses the same-day small/medium/large rename.

UPDATE "orders" SET "package_size" = 'ripple' WHERE "package_size" = 'small';
UPDATE "orders" SET "package_size" = 'wave'   WHERE "package_size" = 'medium';
UPDATE "orders" SET "package_size" = 'swell'  WHERE "package_size" = 'large';

INSERT INTO "platform_config" ("key", "value", "updated_at") VALUES
  ('size_price_ripple', '60.00', now()),
  ('size_price_wave',   '70.00', now()),
  ('size_price_swell',  '80.00', now()),
  ('size_price_tide',   '160.00', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();

DELETE FROM "platform_config" WHERE "key" IN ('size_price_small', 'size_price_medium', 'size_price_large');
