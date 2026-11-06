-- Test accounts for outside reviewers: their orders stay out of every shop,
-- rider, dispatch and stats view.
ALTER TABLE "profiles" ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "is_test" BOOLEAN NOT NULL DEFAULT false;
