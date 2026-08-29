-- Splits the rider's online/offline toggle off the account ban flag.
--
-- `PATCH /riders/availability` wrote `profiles.is_active`, and
-- `plugins/auth.ts` rejects every authenticated request when that column is
-- false. A rider tapping "Offline" therefore locked themselves out of the app
-- and could not tap it back on — only an admin could, from a screen that
-- labels the same flag "Deactivated".
--
-- Defaults to true so every existing rider is online after this runs, which
-- matches what the toggle showed them before it.
ALTER TABLE "profiles" ADD COLUMN "is_available" BOOLEAN NOT NULL DEFAULT true;

-- Deliberately NOT backfilling `is_active` from this. A rider sitting at
-- is_active = false is either self-locked-out by the old toggle or banned by
-- an admin, and nothing in the row distinguishes the two — so flipping them
-- all back to true here would silently un-ban anyone an admin had removed.
-- Reactivate the self-locked ones by hand in admin → Users; the pilot has not
-- opened, so the expected count is zero.
