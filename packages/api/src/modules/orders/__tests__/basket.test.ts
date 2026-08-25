import { describe, expect, it, vi } from "vitest";
import { buildManualBasket, describeLines, priceCatalogueBasket } from "../basket";

/**
 * The basket is where CLAUDE.md's "never trust client-sent price" rule is
 * actually enforced, so these tests are mostly about what the server refuses.
 *
 * Note there is no test for "ignores a price sent by the client": the wire
 * format has no price field to send. That is the design — the guarantee comes
 * from `orderItemInputSchema` accepting only `{ productId, quantity }`, not
 * from a check somewhere that could be forgotten.
 */
describe("priceCatalogueBasket", () => {
  function fastifyWith(products: unknown[]) {
    const findMany = vi.fn().mockResolvedValue(products);
    return {
      fastify: { prisma: { product: { findMany } } } as never,
      findMany,
    };
  }

  const JOLLOF = { id: "p1", name: "Jollof Rice", price: 35, status: "active" };
  const COKE = { id: "p2", name: "Coke", price: 5.5, status: "active" };

  it("prices from the database, not from the request", async () => {
    const { fastify } = fastifyWith([JOLLOF, COKE]);

    const result = await priceCatalogueBasket({
      fastify,
      shopId: "shop-1",
      items: [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 35*2 + 5.50 = 75.50
    expect(result.itemsTotal).toBe(75.5);
    expect(result.lines).toEqual([
      { productId: "p1", name: "Jollof Rice", unitPrice: 35, quantity: 2 },
      { productId: "p2", name: "Coke", unitPrice: 5.5, quantity: 1 },
    ]);
  });

  it("scopes the product lookup to the shop being ordered from", async () => {
    const { fastify, findMany } = fastifyWith([JOLLOF]);

    await priceCatalogueBasket({
      fastify,
      shopId: "shop-1",
      items: [{ productId: "p1", quantity: 1 }],
    });

    // Without `shopId` in the where clause a student could assemble a basket
    // from another shop's cheaper menu and have this runner buy it here.
    expect(findMany.mock.calls[0]![0].where).toMatchObject({ shopId: "shop-1" });
  });

  it("refuses a product that is not on this shop's menu", async () => {
    const { fastify } = fastifyWith([]); // nothing matched shopId

    const result = await priceCatalogueBasket({
      fastify,
      shopId: "shop-1",
      items: [{ productId: "p1", quantity: 1 }],
    });

    expect(result.ok).toBe(false);
  });

  it("refuses an out-of-stock item rather than silently charging for it", async () => {
    const { fastify } = fastifyWith([{ ...JOLLOF, status: "out_of_stock" }]);

    const result = await priceCatalogueBasket({
      fastify,
      shopId: "shop-1",
      items: [{ productId: "p1", quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/out of stock/i);
  });

  it("refuses the same product twice, which would double-charge", async () => {
    const { fastify } = fastifyWith([JOLLOF]);

    const result = await priceCatalogueBasket({
      fastify,
      shopId: "shop-1",
      items: [
        { productId: "p1", quantity: 1 },
        { productId: "p1", quantity: 1 },
      ],
    });

    expect(result.ok).toBe(false);
  });

  it("rounds to the pesewa so a total never carries float dust", async () => {
    const { fastify } = fastifyWith([{ id: "p1", name: "Sachet", price: 0.1, status: "active" }]);

    const result = await priceCatalogueBasket({
      fastify,
      shopId: "shop-1",
      items: [{ productId: "p1", quantity: 3 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.itemsTotal).toBe(0.3); // not 0.30000000000000004
  });
});

describe("buildManualBasket", () => {
  it("carries no prices — nobody knows them until the rider is at the till", () => {
    const result = buildManualBasket([
      { name: "Bag of rice", quantity: 1 },
      { name: "Tin tomatoes", quantity: 3 },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.itemsTotal).toBe(0);
    expect(result.lines.every((l) => l.unitPrice === null)).toBe(true);
    expect(result.lines.every((l) => l.productId === null)).toBe(true);
  });
});

describe("describeLines", () => {
  it("summarises the basket the way a runner reads it", () => {
    expect(
      describeLines([
        { productId: "p1", name: "Jollof Rice", unitPrice: 35, quantity: 2 },
        { productId: "p2", name: "Coke", unitPrice: 5.5, quantity: 1 },
      ]),
    ).toBe("2x Jollof Rice, 1x Coke");
  });

  it("stays inside the column's 500-char limit", () => {
    const lines = Array.from({ length: 40 }, (_, i) => ({
      productId: `p${i}`,
      name: "A product with a fairly long name indeed",
      unitPrice: 1,
      quantity: 1,
    }));
    expect(describeLines(lines).length).toBeLessThanOrEqual(500);
  });
});
