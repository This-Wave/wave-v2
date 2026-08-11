import { describe, expect, it, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { orderRoutes } from "../routes";

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
