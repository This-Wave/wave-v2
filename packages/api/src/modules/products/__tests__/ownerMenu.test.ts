import { describe, expect, test, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { productRoutes } from "../routes";

/**
 * `GET /shops/:shopId/products/manage` — the shop owner's own menu.
 *
 * The bug this route fixes: the public `/products` closes with Buy for me, and
 * the gate caught the owner too. During the pre-launch window — which exists so
 * vendors can be onboarded — an owner could add items through the ungated POST
 * and then never read them back. The menu they were being onboarded to build
 * was the one thing they could not see.
 */
const PRODUCTS = [
  { id: "p1", shopId: "shop-1", name: "Shea butter", status: "active" },
  { id: "p2", shopId: "shop-1", name: "Hair oil", status: "not_serving" },
];

/** Buy for me un-launched: the state the owner used to be locked out by. */
const PRE_LAUNCH = {
  serviceSwitch: {
    findMany: async () => [
      { key: "buy_for_me", universityId: null, paused: true, hidden: true, message: "Coming soon", resumeAt: null },
    ],
  },
};

function prismaFor(ownerId: string | null) {
  return {
    ...PRE_LAUNCH,
    shop: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; ownerId: string } }) =>
        where.ownerId === ownerId ? { id: where.id } : null,
      ),
      findUnique: vi.fn().mockResolvedValue({ universityId: "uni-1" }),
    },
    product: { findMany: vi.fn().mockResolvedValue(PRODUCTS) },
  };
}

describe("GET /shops/:shopId/products/manage", () => {
  test("the owner reads their menu even while Buy for me has not launched", async () => {
    const prisma = prismaFor("owner-1");
    const app = await buildTestApp(productRoutes, {
      prisma,
      user: { id: "owner-1", role: "shop_owner" },
    });

    const res = await app.inject({ method: "GET", url: "/shops/shop-1/products/manage" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ products: PRODUCTS });
    await app.close();
  });

  test("returns every status, because those are what the owner came to change", async () => {
    const prisma = prismaFor("owner-1");
    const app = await buildTestApp(productRoutes, {
      prisma,
      user: { id: "owner-1", role: "shop_owner" },
    });

    await app.inject({ method: "GET", url: "/shops/shop-1/products/manage" });

    // No status filter: a `not_serving` item the owner cannot see is one they
    // cannot put back on sale.
    expect(prisma.product.findMany).toHaveBeenCalledWith({ where: { shopId: "shop-1" } });
    await app.close();
  });

  test("another owner's shop is refused", async () => {
    const prisma = prismaFor("owner-1");
    const app = await buildTestApp(productRoutes, {
      prisma,
      user: { id: "someone-else", role: "shop_owner" },
    });

    const res = await app.inject({ method: "GET", url: "/shops/shop-1/products/manage" });

    expect(res.statusCode).toBe(403);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    await app.close();
  });

  test("a student cannot use the owner route to bypass the launch gate", async () => {
    const prisma = prismaFor("owner-1");
    const app = await buildTestApp(productRoutes, {
      prisma,
      user: { id: "student-1", role: "student" },
    });

    const res = await app.inject({ method: "GET", url: "/shops/shop-1/products/manage" });

    expect(res.statusCode).toBe(403);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    await app.close();
  });

  test("unauthenticated is refused", async () => {
    const app = await buildTestApp(productRoutes, { prisma: prismaFor("owner-1"), user: null });

    const res = await app.inject({ method: "GET", url: "/shops/shop-1/products/manage" });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe("GET /shops/:shopId/products — still gated", () => {
  test("the public route keeps returning 503 before launch", async () => {
    // The fix must not have loosened the student-facing route on the way past.
    const app = await buildTestApp(productRoutes, {
      prisma: prismaFor("owner-1"),
      user: null,
    });

    const res = await app.inject({ method: "GET", url: "/shops/shop-1/products" });

    expect(res.statusCode).toBe(503);
    expect(res.json().products).toEqual([]);
    await app.close();
  });
});
