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
        Promise.resolve(where.key === "delivery_fee_base" ? { value: "50.00" } : null),
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
    },
  });
  await app.close();
  return { res, created: prisma.order.create.mock.calls[0]?.[0]?.data };
}

beforeEach(() => vi.clearAllMocks());

describe("POST /orders — Accra zone pricing", () => {
  test("a pickup collected in a zone is charged that zone's fee", async () => {
    const { res, created } = await pickup(ZONE_POINT, CAMPUS, [
      { id: ZONE_POINT, zone: zone("80.00") },
      { id: CAMPUS, zone: null },
    ]);
    expect(res.statusCode).toBe(201);
    expect(created.deliveryFee).toBe(80);
    expect(created.totalAmount).toBe(80);
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
