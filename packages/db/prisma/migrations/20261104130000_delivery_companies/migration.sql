-- Deliveries can be run by a delivery company instead of independent riders.
-- The switch itself is platform_config.delivery_mode ('independent' | 'company').

ALTER TYPE "ProfileRole" ADD VALUE IF NOT EXISTS 'dispatcher';

CREATE TYPE "CompanyRateType" AS ENUM ('flat', 'percent');

CREATE TABLE "delivery_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rate_type" "CompanyRateType",
    "rate_value" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "delivery_companies_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "profiles" ADD COLUMN "company_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "company_id" TEXT,
    ADD COLUMN "assigned_at" TIMESTAMP(3),
    ADD COLUMN "assigned_by_id" TEXT;

CREATE INDEX "orders_company_id_scheduled_date_idx" ON "orders"("company_id", "scheduled_date");

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "delivery_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "delivery_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "platform_config" ("key", "value", "description", "updated_at") VALUES
  ('delivery_mode', 'independent', 'Who runs deliveries: independent | company', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
