import { describe, expect, test, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { shopRoutes } from "../routes";

/**
 * `GET /shops/:id` is public and unauthenticated. It used to be a bare
 * `findUnique` on the id while the listing filtered `isActive`/`isVerified`
 * (review 01-cybersecurity, L2), so deactivating a shop removed it from the
 * listing but left it fully readable to anyone holding its id.
 */
describe("GET /shops/:id — public visibility (L2)", () => {
  test("gates the lookup on isActive and isVerified", async () => {
    const prisma = {
      shop: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn() },
    };
    const app = await buildTestApp(shopRoutes, { prisma, user: null });

    const res = await app.inject({ method: "GET", url: "/shop-1" });

    expect(prisma.shop.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "shop-1", isActive: true, isVerified: true },
      }),
    );
    // An unfiltered findUnique here is the bug itself.
    expect(prisma.shop.findUnique).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  test("a hidden shop is indistinguishable from a missing one", async () => {
    // Same 404 body either way — a distinct status or message would confirm the
    // id exists, which is most of what an enumerator wants.
    const prisma = { shop: { findFirst: vi.fn().mockResolvedValue(null) } };
    const app = await buildTestApp(shopRoutes, { prisma, user: null });

    const res = await app.inject({ method: "GET", url: "/deactivated-shop" });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Shop not found" });
    await app.close();
  });

  test("still returns a live shop with its products", async () => {
    const shop = {
      id: "shop-1",
      name: "Mama Put Kitchen",
      isActive: true,
      isVerified: true,
      products: [{ id: "p1", name: "Jollof", status: "active" }],
    };
    const prisma = { shop: { findFirst: vi.fn().mockResolvedValue(shop) } };
    const app = await buildTestApp(shopRoutes, { prisma, user: null });

    const res = await app.inject({ method: "GET", url: "/shop-1" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ shop });
    await app.close();
  });

  test("returns out_of_stock products rather than hiding them", async () => {
    // They are a display state the storefront greys out, not rows to omit.
    const prisma = { shop: { findFirst: vi.fn().mockResolvedValue({ id: "shop-1", products: [] }) } };
    const app = await buildTestApp(shopRoutes, { prisma, user: null });

    await app.inject({ method: "GET", url: "/shop-1" });

    expect(prisma.shop.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ include: { products: true } }),
    );
    await app.close();
  });
});
