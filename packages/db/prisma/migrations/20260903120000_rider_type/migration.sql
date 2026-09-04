-- Student riders and riders hired from outside the university.
--
-- Riders could only ever be students in practice, and the only signal was
-- `profiles.student_id` — an optional free-text field. Inferring from it is
-- wrong in the direction that matters: a student who never typed their ID reads
-- as external, and that decides which documents they must produce, what they
-- are paid, and where they may deliver.

CREATE TYPE "RiderType" AS ENUM ('student', 'external');

ALTER TABLE "profiles" ADD COLUMN "rider_type" "RiderType";

-- Every rider that exists before this migration signed up through a flow only
-- students could reach, so 'student' is accurate rather than merely convenient.
-- Non-riders stay null; there is no sensible rider type for a shop owner.
UPDATE "profiles" SET "rider_type" = 'student' WHERE "role" = 'rider';

-- --------------------------------------------------------------------------
-- Where an external rider may deliver.
--
-- Defaults to FALSE — deny. An access rule that defaults to "allowed" is only a
-- rule once somebody remembers to turn it on, and this one exists because
-- people with no institutional tie to the campus are being let onto it. The
-- cost of the safe default is that external riders see an empty feed until an
-- admin opens checkpoints to them, which the rider app explains in words rather
-- than showing a blank screen.
--
-- Existing checkpoints are NOT backfilled to true. Opening every checkpoint on
-- campus to outsiders is precisely the decision this column exists to make
-- deliberate.
ALTER TABLE "checkpoints"
  ADD COLUMN "external_riders_allowed" BOOLEAN NOT NULL DEFAULT false;

-- --------------------------------------------------------------------------
-- The extra evidence an external rider provides.
--
-- All nullable: a student rider's verification carries none of them. Enforcement
-- that an external rider supplies all of them lives in the API, which is the
-- only layer that knows the rider's type at submission time.
ALTER TABLE "rider_verifications"
  ADD COLUMN "guarantor_name"        TEXT,
  ADD COLUMN "guarantor_phone"       TEXT,
  ADD COLUMN "second_id_type"        "RiderIdType",
  ADD COLUMN "second_id_number"      TEXT,
  ADD COLUMN "second_id_image_path"  TEXT,
  ADD COLUMN "proof_of_address_path" TEXT,
  ADD COLUMN "reference_name"        TEXT,
  ADD COLUMN "reference_contact"     TEXT;

-- --------------------------------------------------------------------------
-- The rate an earning was actually calculated at.
--
-- Student and external riders are paid at separate configurable percentages,
-- both editable in admin with no deploy. Without this column, changing a rate
-- silently rewrites the apparent basis of every past delivery and a rider
-- disputing an old payment cannot be answered.
--
-- Nullable, and existing rows are left null rather than backfilled with today's
-- 80%: that value is a guess about the past, and a guess recorded as fact is
-- worse than an honest gap.
ALTER TABLE "rider_earnings" ADD COLUMN "rate_pct" DECIMAL(5,2);
