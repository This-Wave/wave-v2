import { describe, expect, it, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { orderRoutes } from "../routes";

const ORDER = {
  id: "order-1",
  studentId: "student-1",
  riderId: "rider-2",
  shopId: "shop-1",
  status: "rider_assigned",
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

describe("negative authz — order access (H9)", () => {
  it("returns 404 when an unassigned rider reads someone else's order", async () => {
    const app = await buildTestApp(orderRoutes, {
      prisma: prismaFor(ORDER),
      user: { id: "rider-99", role: "rider" },
    });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("returns 404 when a shop owner reads an order for a shop they do not own", async () => {
    const app = await buildTestApp(orderRoutes, {
      prisma: prismaFor(ORDER, false),
      user: { id: "owner-1", role: "shop_owner" },
    });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("lets admin read any order", async () => {
    const app = await buildTestApp(orderRoutes, {
      prisma: prismaFor(ORDER),
      user: { id: "admin-1", role: "admin" },
    });
    const res = await app.inject({ method: "GET", url: "/order-1" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe("negative authz — deliver without assignment (H9)", () => {
  it("returns 403 when a rider tries to deliver an order assigned to someone else", async () => {
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "order-1",
          studentId: "student-1",
          riderId: "rider-2",
          orderType: "shop_catalog",
          deliveryPinHash: "$2b$10$hash",
        }),
        update: vi.fn(),
      },
      profile: { findUnique: vi.fn() },
      orderStatusHistory: { create: vi.fn() },
      studentDeliveryStats: { upsert: vi.fn() },
    };

    const app = await buildTestApp(orderRoutes, {
      prisma,
      user: { id: "rider-1", role: "rider" },
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/order-1/deliver",
      payload: { pin: "123456" },
    });

    expect(res.statusCode).toBe(403);
    expect(prisma.order.update).not.toHaveBeenCalled();
    await app.close();
  });
});
