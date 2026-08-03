-- Store Storage paths, not signed URLs.
--
-- These columns held a 7-day signed URL, so admin review of a verification
-- silently broke a week after the rider submitted it. The API now stores the
-- path inside the private "verifications" bucket and signs a fresh URL on
-- every read.
--
-- RENAME rather than drop-and-add: Prisma's own diff would have dropped both
-- columns and lost every submission. Rows written before this migration still
-- contain an absolute URL; the read path passes those through untouched.
ALTER TABLE "rider_verifications" RENAME COLUMN "id_image_url" TO "id_image_path";
ALTER TABLE "rider_verifications" RENAME COLUMN "selfie_url" TO "selfie_path";
