-- `PATCH /orders/:id/shop-accept` set status='confirmed' on an order that was
-- already 'confirmed' — a literal no-op with a route and a role gate. A shop
-- owner tapping "Accept" changed nothing and got no record that they had.
--
-- Rather than invent an `awaiting_shop` status (which would gate the rider feed
-- and change the money path), acceptance is recorded as a timestamp. It is
-- advisory: it blocks nothing, but it is now a fact the dashboard can show and
-- an admin can audit.
ALTER TABLE "orders" ADD COLUMN "shop_accepted_at" TIMESTAMP(3);
