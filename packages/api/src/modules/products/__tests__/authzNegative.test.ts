import { describe, expect, it, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { productRoutes } from "../routes";

describe("product routes — negative authz (H9)", () => {
  it("returns 404 when a shop owner edits another shop's product", async () => {
    const prisma = {
      product: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const app = await buildTestApp(productRoutes, {
      prisma,
      user: { id: "owner-a", role: "shop_owner" },
    });

    const res = await app.inject({
      method: "PUT",
      url: "/products/product-1",
      payload: { name: "Hacked" },
    });

    expect(res.statusCode).toBe(404);
    expect(prisma.product.update).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 403 when creating a product on a shop the user does not own", async () => {
    const prisma = {
      shop: { findFirst: vi.fn().mockResolvedValue(null) },
      product: { create: vi.fn() },
    };

    const app = await buildTestApp(productRoutes, {
      prisma,
      user: { id: "owner-a", role: "shop_owner" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/shops/shop-1/products",
      payload: { name: "Jollof", price: 25, category: "Food" },
    });

    expect(res.statusCode).toBe(403);
    expect(prisma.product.create).not.toHaveBeenCalled();
    await app.close();
  });
});
