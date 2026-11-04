-- Every day is a delivery day from 2026-11-04 (was Sunday + Wednesday).
-- `special` stays for orders placed under the old rush rule.
ALTER TYPE "DeliveryDay" ADD VALUE IF NOT EXISTS 'monday';
ALTER TYPE "DeliveryDay" ADD VALUE IF NOT EXISTS 'tuesday';
ALTER TYPE "DeliveryDay" ADD VALUE IF NOT EXISTS 'thursday';
ALTER TYPE "DeliveryDay" ADD VALUE IF NOT EXISTS 'friday';
ALTER TYPE "DeliveryDay" ADD VALUE IF NOT EXISTS 'saturday';
