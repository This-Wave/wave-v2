-- Catalogue baskets, shop suggestions, and rider-recorded goods cost.
--
-- Three things land together because they are one product change:
--
--  1. An order stops being a wall of free text and becomes a list of items. A
--     student picks from the shop's real catalogue, so Wave knows the price
--     before anyone walks anywhere.
--  2. When the shop is NOT on Wave, the student suggests it. The suggestion is
--     both a real order (type 'shop_pickup') and a demand signal admin ranks.
--  3. A 'shop_pickup' has no known price at order time, so the rider records
--     what they actually paid per item and a second charge is raised.
--
-- Hand-written, like 20260807150000, for the same reason: `migrate diff` wants
-- to recreate `orders` to change a constraint, which would destroy every row.
-- Every statement below is additive or relaxing.

-- ---------------------------------------------------------------------------
-- 1. Email. Auth is phone-based, so this is nullable and always will be —
--    a student who never gives an email must still be able to order.
--    Used by the "the shop you suggested is now on Wave" notification.
-- ---------------------------------------------------------------------------
ALTER TABLE "profiles" ADD COLUMN "email" TEXT;

-- ---------------------------------------------------------------------------
-- 2. Shop suggestions.
--
--    `normalized_name` is the whole point of this table. Ranking by demand only
--    works if "Melcom", "melcom " and "MELCOM Berekuso" count as one place, so
--    the API lowercases, strips punctuation and collapses whitespace on write,
--    and admin groups on this column rather than on `name`.
-- ---------------------------------------------------------------------------
CREATE TYPE "SuggestionStatus" AS ENUM ('pending', 'onboarded', 'rejected');

CREATE TABLE "shop_suggestions" (
  "id"               TEXT NOT NULL,
  "student_id"       TEXT NOT NULL,
  "university_id"    TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "normalized_name"  TEXT NOT NULL,
  "location_text"    TEXT,
  "category"         TEXT,
  "status"           "SuggestionStatus" NOT NULL DEFAULT 'pending',
  "resolved_shop_id" TEXT,
  "notified_at"      TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shop_suggestions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "shop_suggestions"
  ADD CONSTRAINT "shop_suggestions_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shop_suggestions"
  ADD CONSTRAINT "shop_suggestions_university_id_fkey"
  FOREIGN KEY ("university_id") REFERENCES "universities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shop_suggestions"
  ADD CONSTRAINT "shop_suggestions_resolved_shop_id_fkey"
  FOREIGN KEY ("resolved_shop_id") REFERENCES "shops"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The ranking query: GROUP BY normalized_name WHERE university_id = ?
CREATE INDEX "shop_suggestions_university_id_normalized_name_idx"
  ON "shop_suggestions"("university_id", "normalized_name");
CREATE INDEX "shop_suggestions_status_idx" ON "shop_suggestions"("status");

-- ---------------------------------------------------------------------------
-- 3. Order items.
--
--    `name` and `unit_price` are SNAPSHOTS, not lookups. A shop editing or
--    deleting a product must never silently rewrite what someone already
--    ordered and paid for, so the row carries its own copy and `product_id` is
--    nullable — both because a manual list has no product, and because the
--    product may be gone by the time anyone reads the order back.
--
--    `unit_price`        — the catalogue price, known upfront. NULL on a manual list.
--    `actual_unit_price` — what the rider actually paid at the till. NULL until
--                          they record it, and only ever set on a 'shop_pickup'.
-- ---------------------------------------------------------------------------
CREATE TABLE "order_items" (
  "id"                TEXT NOT NULL,
  "order_id"          TEXT NOT NULL,
  "product_id"        TEXT,
  "name"              TEXT NOT NULL,
  "unit_price"        DECIMAL(10,2),
  "quantity"          INTEGER NOT NULL DEFAULT 1,
  "actual_unit_price" DECIMAL(10,2),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0)
);

-- CASCADE here, unlike everywhere else in this schema, because an order item
-- has no meaning apart from its order — there is no history to preserve.
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- ---------------------------------------------------------------------------
-- 4. The order's link to a suggestion, and the second charge.
--
--    A 'shop_pickup' is paid in two parts: the delivery fee at order time
--    (`paystack_ref`), and the goods once the rider reports the till total
--    (`goods_paystack_ref`). Two refs, because they are two Paystack
--    transactions and each needs its own idempotency key for the webhook.
-- ---------------------------------------------------------------------------
ALTER TABLE "orders" ADD COLUMN "suggestion_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "goods_paystack_ref" TEXT;
ALTER TABLE "orders" ADD COLUMN "goods_paid_at" TIMESTAMP(3);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_goods_paystack_ref_key" UNIQUE ("goods_paystack_ref");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_suggestion_id_fkey"
  FOREIGN KEY ("suggestion_id") REFERENCES "shop_suggestions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Extend the shape constraint to the third type.
--
--    Dropped and recreated rather than added alongside, so there is exactly one
--    statement in the schema describing what each order type looks like. The
--    Zod refinements in packages/shared/src/schemas/order.ts mirror this
--    exactly — change one, change both.
-- ---------------------------------------------------------------------------
ALTER TABLE "orders" DROP CONSTRAINT "orders_shape_matches_type";

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_shape_matches_type" CHECK (
    (order_type = 'buy_for_me'
      AND shop_id IS NOT NULL
      AND origin_checkpoint_id IS NULL
      AND suggestion_id IS NULL)
    OR
    (order_type = 'pickup'
      AND shop_id IS NULL
      AND origin_checkpoint_id IS NOT NULL
      AND suggestion_id IS NULL)
    OR
    -- The shop is not on Wave yet, so there is nothing to point `shop_id` at.
    -- The suggestion carries the name and location the runner needs.
    (order_type = 'shop_pickup'
      AND shop_id IS NULL
      AND origin_checkpoint_id IS NULL
      AND suggestion_id IS NOT NULL)
  );
