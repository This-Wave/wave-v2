import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";

vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));
vi.mock("../../suggestions/announce", () => ({ announceShopIsLive: vi.fn() }));

import { adminRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * `pendingShops` exists because a shop owner can now register in the app, and
 * `POST /shops` leaves `isVerified` false. The public shop routes filter on
 * `isActive && isVerified`, so an unapproved shop is invisible to every
 * student — and invisible to the admin too, unless something counts it. Its
 * owner cannot tell the difference between "not approved yet" and "Wave has no
 * customers", so a missed approval reads as the product being dead.
 */
const ADMIN = { id: "admin-1", role: "admin" as Role };

function makePrisma() {
  return {
    order: {
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }),
    },
    profile: { count: vi.fn().mockResolvedValue(0) },
    shop: { count: vi.fn() },
    riderVerification: { count: vi.fn().mockResolvedValue(0) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /admin/stats", () => {
  test("counts shops still awaiting approval", async () => {
    const prisma = makePrisma();
    // First shop.count is the total, second is the unverified filter.
    prisma.shop.count.mockResolvedValueOnce(12).mockResolvedValueOnce(3);

    const app = await buildTestApp(adminRoutes, { prisma, user: ADMIN });
    const res = await app.inject({ method: "GET", url: "/stats" });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(res.json().pendingShops).toBe(3);
    expect(res.json().totalShops).toBe(12);
  });

  test("asks for unverified shops specifically, not every shop", async () => {
    const prisma = makePrisma();
    prisma.shop.count.mockResolvedValue(0);

    const app = await buildTestApp(adminRoutes, { prisma, user: ADMIN });
    await app.inject({ method: "GET", url: "/stats" });
    await app.close();

    // A bare count() here would report every shop as pending and make the
    // dashboard badge permanently wrong.
    expect(prisma.shop.count).toHaveBeenCalledWith({ where: { isVerified: false } });
  });

  test("reports zero when every shop is approved", async () => {
    const prisma = makePrisma();
    prisma.shop.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);

    const app = await buildTestApp(adminRoutes, { prisma, user: ADMIN });
    const res = await app.inject({ method: "GET", url: "/stats" });
    await app.close();

    expect(res.json().pendingShops).toBe(0);
  });
});
