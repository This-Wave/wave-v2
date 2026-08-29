-- Replaces two in-process locks (a Set of in-flight refunds, a Map of PIN
-- resend timestamps) with columns, so the guarantee survives running more than
-- one API instance.
--
-- refund_started_at: claimed by a conditional UPDATE before Paystack is called,
-- cleared on failure. Null means no refund is in flight.
ALTER TABLE "orders" ADD COLUMN "refund_started_at" TIMESTAMP(3);

-- last_pin_resend_at: backs the per-order delivery-PIN resend cooldown.
ALTER TABLE "orders" ADD COLUMN "last_pin_resend_at" TIMESTAMP(3);
