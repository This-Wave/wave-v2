-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('owner', 'accountant', 'claims_officer', 'logistics_head', 'support', 'auditor');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "staff_role" "StaffRole";

-- Every admin who exists today set Wave up, so each becomes an owner. Without
-- this, deploying the migration would lock every admin out of every page.
UPDATE "profiles" SET "staff_role" = 'owner' WHERE "role" = 'admin' AND "staff_role" IS NULL;
