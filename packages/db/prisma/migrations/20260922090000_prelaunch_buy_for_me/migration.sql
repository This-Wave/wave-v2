-- AlterTable
ALTER TABLE "service_switch" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;


-- Buy for me starts closed, and the deploy is what closes it.
--
-- Wave launches with Pickup only, while shops are still being onboarded. A
-- switch nobody has touched means "running" (see SERVICE_SWITCHES), so without
-- this row a production deploy would open Buy for me the moment it went live —
-- to a campus with no shops on it. `hidden` makes the app leave the service out
-- altogether rather than show it as paused: no tab, no shop browsing.
--
-- Only inserted when no global row exists, so re-running this on a database
-- where someone has already decided is a no-op. Opening it is one button in
-- admin → Config → Ordering.
INSERT INTO "service_switch" ("id", "key", "university_id", "paused", "hidden", "message", "updated_at")
SELECT gen_random_uuid(), 'buy_for_me', NULL, true, true,
       'Buy for me is coming soon — we''re signing up shops now. Pickup works today.', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "service_switch" WHERE "key" = 'buy_for_me' AND "university_id" IS NULL
);
