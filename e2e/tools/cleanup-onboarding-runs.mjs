/**
 * Delete the Neon rows the onboarding journeys create, so a run leaves the
 * database as it found it.
 *
 * The Supabase auth users are removed by the specs themselves (`afterAll` →
 * `deleteCreatedAccounts`), but deleting an auth user does NOT remove the
 * `Profile` row the app wrote for it, nor that profile's shop, order or
 * verification. Without this, every recording session leaves a handful of
 * orphaned accounts on live infrastructure and pads the admin dashboard's user
 * and order counts.
 *
 * Matched on the three fixed names the specs type into the profile form, NOT on
 * the phone number: the throwaway numbers are `+23320…`, and the seeded shop
 * owner is `+233201234567`, so a prefix match would delete a dev account. Names
 * are exact, so the blast radius is precisely what the specs created.
 *
 * Run from the repo root, after a recording session:
 *   node e2e/tools/cleanup-onboarding-runs.mjs
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

for (const line of readFileSync("packages/api/.env", "utf8").split("\n")) {
  const match = /^\s*(DATABASE_URL)\s*=\s*(.*)$/.exec(line);
  if (match) process.env.DATABASE_URL = match[2].trim().replace(/^["'](.*)["']$/, "$1");
}

/** Kept in step with the names in e2e/specs/*-onboarding.spec.ts. */
const NAMES = ["Adjoa Mensimah", "Yaw Darko", "Akosua Frimpong"];

const prisma = new PrismaClient();

const profiles = await prisma.profile.findMany({
  where: { fullName: { in: NAMES } },
  select: { id: true, fullName: true, phone: true, role: true },
});

if (profiles.length === 0) {
  console.log("nothing to clean up");
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`throwaway profiles: ${profiles.length}`);
for (const p of profiles) console.log("  ", p.role, p.fullName, p.phone);

const ids = profiles.map((p) => p.id);
const shops = await prisma.shop.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
const shopIds = shops.map((s) => s.id);

// Order matters: every child row goes before the profile it points at, or the
// delete fails on a foreign key.
const steps = [
  ["order status history", () => prisma.orderStatusHistory.deleteMany({ where: { OR: [{ changedBy: { in: ids } }, { order: { OR: [{ studentId: { in: ids } }, { shopId: { in: shopIds } }] } }] } })],
  ["rider earnings", () => prisma.riderEarning.deleteMany({ where: { OR: [{ riderId: { in: ids } }, { order: { studentId: { in: ids } } }] } })],
  ["orders", () => prisma.order.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { riderId: { in: ids } }, { shopId: { in: shopIds } }] } })],
  ["rider verifications", () => prisma.riderVerification.deleteMany({ where: { OR: [{ riderId: { in: ids } }, { reviewedBy: { in: ids } }] } })],
  ["shop suggestions", () => prisma.shopSuggestion.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { resolvedShopId: { in: shopIds } }] } })],
  ["products", () => prisma.product.deleteMany({ where: { shopId: { in: shopIds } } })],
  ["shops", () => prisma.shop.deleteMany({ where: { ownerId: { in: ids } } })],
  ["delivery stats", () => prisma.studentDeliveryStats.deleteMany({ where: { studentId: { in: ids } } })],
  ["profiles", () => prisma.profile.deleteMany({ where: { id: { in: ids } } })],
];

for (const [label, run] of steps) {
  try {
    const { count } = await run();
    if (count > 0) console.log(`deleted ${count} ${label}`);
  } catch (error) {
    console.error(`could not delete ${label}:`, error.message);
    throw error;
  }
}

console.log(`\nremaining profiles: ${await prisma.profile.count()}`);
console.log(`remaining orders:   ${await prisma.order.count()}`);
console.log(`remaining shops:    ${await prisma.shop.count()}`);

await prisma.$disconnect();
