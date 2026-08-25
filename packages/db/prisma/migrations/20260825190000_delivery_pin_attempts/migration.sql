-- Caps guesses at the delivery PIN.
--
-- `PATCH /orders/:id/deliver` verified the PIN with no attempt counter and no
-- rate limit. The rider assigned to an order can call it as often as they like,
-- so the 6-digit space was grindable — and closing a delivery is the rider
-- asserting they handed the goods over. bcrypt makes that slow, not impossible.
--
-- Counts failures since the current PIN was issued. Zeroed whenever a PIN is
-- issued or re-issued, and on a correct entry.
ALTER TABLE "orders" ADD COLUMN "delivery_pin_attempts" INTEGER NOT NULL DEFAULT 0;
