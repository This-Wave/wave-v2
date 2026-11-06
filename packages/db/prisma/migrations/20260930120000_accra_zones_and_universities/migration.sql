-- AlterTable
ALTER TABLE "checkpoints" ADD COLUMN     "zone_id" TEXT;

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Accra',
    "delivery_fee" DECIMAL(10,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zones_code_key" ON "zones"("code");

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Pricing moves from one flat fee to Accra zones (owner, 2026-09-30).
--
-- The base fee becomes GHS 50 and is what the nearest zone costs; further
-- zones cost more. Every statement below is written to be a no-op when re-run,
-- and the zone fees are starting values — change them in admin → Config.

UPDATE "platform_config" SET "value" = '50.00', "updated_at" = NOW()
WHERE "key" = 'delivery_fee_base';

INSERT INTO "zones" ("id", "code", "name", "city", "delivery_fee", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'A', 'Legon & East Legon',        'Accra', 50.00, 1, NOW()),
  (gen_random_uuid(), 'B', 'Airport, Osu & Cantonments', 'Accra', 60.00, 2, NOW()),
  (gen_random_uuid(), 'C', 'Central Accra',              'Accra', 70.00, 3, NOW()),
  (gen_random_uuid(), 'D', 'Tema & Spintex',             'Accra', 80.00, 4, NOW()),
  (gen_random_uuid(), 'E', 'Kasoa & Weija',              'Accra', 90.00, 5, NOW())
ON CONFLICT ("code") DO NOTHING;

-- The Accra universities Wave delivers to, alongside Ashesi.
INSERT INTO "universities" ("id", "name", "slug", "city", "country", "is_active", "updated_at")
SELECT gen_random_uuid(), v.name, v.slug, v.city, 'Ghana', true, NOW()
FROM (VALUES
  ('University of Ghana', 'university-of-ghana', 'Legon'),
  ('University of Professional Studies, Accra (UPSA)', 'upsa', 'East Legon'),
  ('Ghana Institute of Management and Public Administration (GIMPA)', 'gimpa', 'Achimota'),
  ('Academic City University', 'academic-city', 'Haatso')
) AS v(name, slug, city)
WHERE NOT EXISTS (SELECT 1 FROM "universities" u WHERE u."slug" = v.slug);

-- Each new campus gets one drop-off checkpoint to start with. Campus admins
-- add, rename and move them from admin → Checkpoints.
INSERT INTO "checkpoints" ("id", "university_id", "name", "description", "updated_at")
SELECT gen_random_uuid(), u."id", 'Main gate', 'Drop-off at the main entrance of ' || u."name", NOW()
FROM "universities" u
WHERE u."slug" IN ('university-of-ghana', 'upsa', 'gimpa', 'academic-city')
  AND NOT EXISTS (SELECT 1 FROM "checkpoints" c WHERE c."university_id" = u."id" AND c."zone_id" IS NULL);

-- Every campus gets a pickup point in every zone. Checkpoints are per campus
-- (a student may only use their own campus's), so the zone is shared and the
-- point is not.
INSERT INTO "checkpoints" ("id", "university_id", "zone_id", "name", "description", "updated_at")
SELECT gen_random_uuid(), u."id", z."id",
       z."name",
       'Pickup anywhere in ' || z."name" || ', Accra. Say exactly where in the description.',
       NOW()
FROM "universities" u CROSS JOIN "zones" z
WHERE u."is_active"
  AND NOT EXISTS (SELECT 1 FROM "checkpoints" c WHERE c."university_id" = u."id" AND c."zone_id" = z."id");
