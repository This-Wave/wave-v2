-- The loyalty discount becomes one-shot: a full card takes 20% off the delivery
-- fee of the NEXT order, then the stamps reset. Until now `total_deliveries >=
-- threshold` made the discount permanent, so the number that earned it was a
-- lifetime counter and could not be spent.
--
-- `total_deliveries` stays exactly as it is — it is the account's history, and
-- the admin and the profile both report on it. The spendable number is new.
ALTER TABLE "student_delivery_stats"
  ADD COLUMN "reward_stamps" INTEGER NOT NULL DEFAULT 0;

-- Carry over the remainder, so the change reads as if the rule had always been
-- this way: 7 deliveries becomes 1 stamp, 12 becomes 0, and nobody is handed a
-- free reward or stripped of a partly-earned card.
--
-- The threshold is read from `platform_config` because that is the runtime
-- source of truth and a campus may have changed it; 6 is the fallback, matching
-- DEFAULT_LOYALTY_THRESHOLD. NULLIF guards a row that exists but is blank or
-- non-numeric, which would otherwise make the whole statement fail.
UPDATE "student_delivery_stats"
SET "reward_stamps" = "total_deliveries" % GREATEST(
  COALESCE(
    (SELECT NULLIF(regexp_replace("value", '\D', '', 'g'), '')::int
     FROM "platform_config" WHERE "key" = 'loyalty_threshold'),
    6
  ),
  1
)
WHERE "total_deliveries" > 0;
