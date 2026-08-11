-- Package pickup: move something a student already has from one checkpoint to
-- another. No shop is involved, so `shop_id` has to become nullable, and the
-- order needs a second checkpoint for where the package is collected from.
--
-- Hand-written rather than generated. `prisma migrate diff` wanted to drop and
-- recreate `orders` to change the shop_id nullability, which would have
-- destroyed every existing order. All four statements below are additive or
-- relaxing; none can lose a row.

-- 1. What kind of order this is. Every existing row is a Buy For Me order, and
--    the DEFAULT backfills them without a separate UPDATE.
CREATE TYPE "OrderType" AS ENUM ('buy_for_me', 'pickup');

ALTER TABLE "orders"
  ADD COLUMN "order_type" "OrderType" NOT NULL DEFAULT 'buy_for_me';

-- 2. A pickup has no shop. Relaxing NOT NULL cannot invalidate existing rows.
ALTER TABLE "orders"
  ALTER COLUMN "shop_id" DROP NOT NULL;

-- 3. Where a package is collected from. Null for Buy For Me, whose origin is
--    the shop. RESTRICT on delete matches every other checkpoint reference —
--    a checkpoint with history is deactivated, never removed.
ALTER TABLE "orders"
  ADD COLUMN "origin_checkpoint_id" TEXT;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_origin_checkpoint_id_fkey"
  FOREIGN KEY ("origin_checkpoint_id") REFERENCES "checkpoints"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. The two kinds are mutually exclusive in what they require. Enforced in the
--    database as well as in Zod, because the API is not the only thing that can
--    write here — the seed script does too.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_shape_matches_type" CHECK (
    (order_type = 'buy_for_me' AND shop_id IS NOT NULL AND origin_checkpoint_id IS NULL)
    OR
    (order_type = 'pickup' AND shop_id IS NULL AND origin_checkpoint_id IS NOT NULL)
  );

CREATE INDEX "orders_order_type_idx" ON "orders"("order_type");
