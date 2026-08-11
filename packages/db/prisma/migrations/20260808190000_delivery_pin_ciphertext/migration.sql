-- Encrypted copy of the delivery PIN for in-app display to the owning student.
-- Rider verification still uses delivery_pin_hash (bcrypt).
ALTER TABLE "orders" ADD COLUMN "delivery_pin_ciphertext" TEXT;
