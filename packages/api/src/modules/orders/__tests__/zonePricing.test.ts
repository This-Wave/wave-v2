import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus: vi.fn(),
  notifyGoodsCostRecorded: vi.fn(),
}));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));

import { orderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * Accra is priced by zone (2026-09-30): a pickup collected in a zone costs that
 * zone's fee instead of the base fee, and a delivery can only end on campus.
 */
const STUDENT = { id: "student-1", role: "student" as Role };
const ZONE_POINT = "44444444-4444-4444-4444-444444444444";
const CAMPUS = "22222222-2222-2222-2222-222222222222";
const CAMPUS_2 = "55555555-5555-5555-5555-555555555555";

function upcomingSunday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 0);
  return d.toISOString().slice(0, 10);
}

const zone = (fee: string, isActive = true) => ({ deliveryFee: fee, isActive });

function makePrisma(checkpoints: { id: string; zone: ReturnType<typeof zone> | null }[]) {
  return {
    serviceSwitch: { findMany: vi.fn().mockResolvedValue([]) },
    platformConfig: {
      findUnique: vi.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(
          where.key === "delivery_fee_base" ? { value: "50.00" } : where.key === "size_price_swell" ? { value: "75.00" } : null,
        ),
      ),
    },
    studentDeliveryStats: { findUnique: vi.fn().mockResolvedValue(null) },
    profile: { findUnique: vi.fn().mockResolvedValue({ universityId: "uni-1" }) },
    checkpoint: { findMany: vi.fn().mockResolvedValue(checkpoints) },
    order: {
      create: vi.fn().mockResolvedValue({ id: "order-1" }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

async function pickup(
  from: string,
  to: string,
  checkpoints: { id: string; zone: ReturnType<typeof zone> | null }[],
  extra: Record<string, unknown> = {},
) {
  const prisma = makePrisma(checkpoints);
  const app = await buildTestApp(orderRoutes, { prisma, user: STUDENT });
  const res = await app.inject({
    method: "POST",
    url: "/",
    payload: {
      orderType: "pickup",
      originCheckpointId: from,
      checkpointId: to,
      itemDescription: "Laptop charger at the Shell station",
      deliveryDay: "sunday",
      isSpecialOrder: false,
      scheduledDate: upcomingSunday(),
      ...extra,
    },
  });
  await app.close();
  return { res, created: prisma.order.create.mock.calls[0]?.[0]?.data };
}

beforeEach(() => vi.clearAllMocks());

describe("POST /orders — Accra zone pricing", () => {
  // v7 (2026-11-26): fee = size price (or the base fee without a size) + the zone's add-on.
  test("without a size: base fee plus the zone add-on", async () => {
    const { res, created } = await pickup(ZONE_POINT, CAMPUS, [
      { id: ZONE_POINT, zone: zone("30.00") },
      { id: CAMPUS, zone: null },
    ]);
    expect(res.statusCode).toBe(201);
    expect(created.deliveryFee).toBe(80);
    expect(created.totalAmount).toBe(80);
  });

  test("with a size: that size's price plus the zone add-on", async () => {
    const { res, created } = await pickup(
      ZONE_POINT,
      CAMPUS,
      [
        { id: ZONE_POINT, zone: zone("10.00") },
        { id: CAMPUS, zone: null },
      ],
      { packageSize: "swell", senderName: "Auntie Esi", senderPhone: "0245550101" },
    );
    expect(res.statusCode).toBe(201);
    expect(created.deliveryFee).toBe(85);
    expect(created.senderPhone).toBe("+233245550101");
    expect(created.packageSize).toBe("swell");
  });

  test("a size with no configured price falls back to its default", async () => {
    const { created } = await pickup(
      ZONE_POINT,
      CAMPUS,
      [
        { id: ZONE_POINT, zone: zone("0.00") },
        { id: CAMPUS, zone: null },
      ],
      { packageSize: "tide" },
    );
    expect(created.deliveryFee).toBe(150);
  });

  test("an unknown size is refused", async () => {
    const { res } = await pickup(ZONE_POINT, CAMPUS, [{ id: ZONE_POINT, zone: zone("0.00") }, { id: CAMPUS, zone: null }], { packageSize: "medium" });
    expect(res.statusCode).toBe(400);
  });

  test("a campus-to-campus move is the base fee", async () => {
    const { res, created } = await pickup(CAMPUS_2, CAMPUS, [
      { id: CAMPUS_2, zone: null },
      { id: CAMPUS, zone: null },
    ]);
    expect(res.statusCode).toBe(201);
    expect(created.deliveryFee).toBe(50);
  });

  test("a zone can never be the drop-off", async () => {
    const { res } = await pickup(CAMPUS, ZONE_POINT, [
      { id: CAMPUS, zone: null },
      { id: ZONE_POINT, zone: zone("60.00") },
    ]);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/campus checkpoint/i);
  });

  test("a switched-off zone is refused", async () => {
    const { res } = await pickup(ZONE_POINT, CAMPUS, [
      { id: ZONE_POINT, zone: zone("60.00", false) },
      { id: CAMPUS, zone: null },
    ]);
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /orders — first-order code", () => {
  const points = [
    { id: ZONE_POINT, zone: zone("10.00") },
    { id: CAMPUS, zone: null },
  ];

  test("HELLOHILL takes 25% off the delivery fee and is kept on the order", async () => {
    const { res, created } = await pickup(ZONE_POINT, CAMPUS, points, { packageSize: "swell", promoCode: "hellohill" });
    expect(res.statusCode).toBe(201);
    expect(created.deliveryFee).toBe(85);
    expect(created.discountApplied).toBe(25);
    expect(created.promoCode).toBe("HELLOHILL");
    expect(created.totalAmount).toBe(63.75);
  });

  test("a wrong code is refused before any order is made", async () => {
    const { res, created } = await pickup(ZONE_POINT, CAMPUS, points, { packageSize: "swell", promoCode: "NOPE" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/doesn't exist/);
    expect(created).toBeUndefined();
  });

  test("no code, no discount", async () => {
    const { created } = await pickup(ZONE_POINT, CAMPUS, points, { packageSize: "swell" });
    expect(created.discountApplied).toBe(0);
    expect(created.promoCode).toBeNull();
  });
});
