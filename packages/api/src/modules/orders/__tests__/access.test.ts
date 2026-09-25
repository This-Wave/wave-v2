import { describe, expect, it, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { orderRoutes } from "../routes";
import { feedOrder } from "../select";

const ORDER = {
  id: "order-1",
  studentId: "student-1",
  riderId: "rider-2",
  shopId: "shop-1",
  status: "confirmed",
};

function prismaFor(order: typeof ORDER | null, shopOwned = false) {
  return {
    order: {
      findUnique: vi.fn().mockResolvedValue(order),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    shop: {
      findFirst: vi.fn().mockResolvedValue(shopOwned ? { id: "shop-1" } : null),
    },
    profile: { findUnique: vi.fn() },
    orderStatusHistory: { create: vi.fn() },
    studentDeliveryStats: { upsert: vi.fn() },
  };
}

describe("GET /orders/:id — access control", () => {
  it("lets the owning student read their order", async () => {
    const app = await buildTestApp(orderRoutes, {
      prisma: prismaFor(ORDER),
      user: { id: "student-1", role: "student" },
    });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("returns 404 for another student", async () => {
    const app = await buildTestApp(orderRoutes, {
      prisma: prismaFor(ORDER),
      user: { id: "student-2", role: "student" },
    });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("lets the assigned rider read the order", async () => {
    const app = await buildTestApp(orderRoutes, {
      prisma: prismaFor(ORDER),
      user: { id: "rider-2", role: "rider" },
    });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("lets the shop owner read orders for their shop", async () => {
    const app = await buildTestApp(orderRoutes, {
      prisma: prismaFor(ORDER, true),
      user: { id: "owner-1", role: "shop_owner" },
    });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

/**
 * A rider deciding whether to take a job opens it from the feed before it is
 * theirs. That used to 404, so riders accepted jobs they had never seen.
 */
describe("GET /orders/:id — a rider reading an unclaimed job", () => {
  function prismaForFeed(
    job: object | null,
    rider: object | null = { isVerified: true, universityId: "uni-1", riderType: "student" },
    previewOn = false,
  ) {
    return {
      order: {
        findUnique: vi.fn().mockResolvedValue({ ...ORDER, riderId: null }),
        findFirst: vi.fn().mockResolvedValue(job),
      },
      shop: { findFirst: vi.fn() },
      profile: { findUnique: vi.fn().mockResolvedValue(rider) },
      featureFlag: {
        findMany: vi
          .fn()
          .mockResolvedValue(previewOn ? [{ key: "rider_earnings_preview", universityId: null, state: "on" }] : []),
      },
      betaApplication: { findUnique: vi.fn().mockResolvedValue(null) },
      platformConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    };
  }

  it("returns the job through the feed's select, without the student", async () => {
    const prisma = prismaForFeed({ id: "order-1" });
    const app = await buildTestApp(orderRoutes, { prisma, user: { id: "rider-9", role: "rider" } });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(200);
    const query = prisma.order.findFirst.mock.calls[0]![0] as { where: Record<string, unknown>; select: object };
    expect(query.select).toBe(feedOrder);
    expect(query.select).not.toHaveProperty("student");
    expect(query.where).toMatchObject({ id: "order-1", status: "confirmed", riderId: null, universityId: "uni-1" });
    await app.close();
  });

  it("quotes the rider's share when the earnings preview is on, as the feed row does", async () => {
    const prisma = prismaForFeed({ id: "order-1", deliveryFee: "20.00" }, undefined, true);
    const app = await buildTestApp(orderRoutes, { prisma, user: { id: "rider-9", role: "rider" } });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    const { order } = res.json() as { order: { estimatedEarning?: string } };
    expect(order.estimatedEarning).toBeDefined();
    expect(Number(order.estimatedEarning)).toBeLessThan(20);
    await app.close();
  });

  it("sends no estimate when the preview is off, so the app shows the fee as a fee", async () => {
    const prisma = prismaForFeed({ id: "order-1", deliveryFee: "20.00" });
    const app = await buildTestApp(orderRoutes, { prisma, user: { id: "rider-9", role: "rider" } });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect((res.json() as { order: object }).order).not.toHaveProperty("estimatedEarning");
    await app.close();
  });

  it("keeps an outside rider to checkpoints opened to them, as the feed does", async () => {
    const prisma = prismaForFeed({ id: "order-1" }, { isVerified: true, universityId: "uni-1", riderType: "external" });
    const app = await buildTestApp(orderRoutes, { prisma, user: { id: "rider-9", role: "rider" } });
    await app.inject({ method: "GET", url: "/order-1" });
    const query = prisma.order.findFirst.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(query.where).toMatchObject({ checkpoint: { externalRidersAllowed: true } });
    await app.close();
  });

  it("is still a 404 when the job is claimed, elsewhere, or not paid", async () => {
    const app = await buildTestApp(orderRoutes, { prisma: prismaForFeed(null), user: { id: "rider-9", role: "rider" } });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("is a 404 for an unverified rider", async () => {
    const prisma = prismaForFeed({ id: "order-1" }, { isVerified: false, universityId: "uni-1", riderType: "student" });
    const app = await buildTestApp(orderRoutes, { prisma, user: { id: "rider-9", role: "rider" } });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(404);
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
    await app.close();
  });

  it("never applies to students, who get no feed", async () => {
    const prisma = prismaForFeed({ id: "order-1" });
    const app = await buildTestApp(orderRoutes, { prisma, user: { id: "student-2", role: "student" } });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(404);
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
    await app.close();
  });
});
