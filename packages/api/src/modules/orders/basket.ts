import type { FastifyInstance } from "fastify";
import type { ManualItemInput, OrderItemInput } from "@wave/shared";

/**
 * A priced basket line, ready to write to `order_items`.
 *
 * `name` and `unitPrice` are snapshots taken now. The shop can edit or delete
 * the product tomorrow; what the student ordered and was charged must not move.
 */
export interface PricedLine {
  productId: string | null;
  name: string;
  unitPrice: number | null;
  quantity: number;
}

export type BasketResult =
  | { ok: true; lines: PricedLine[]; itemsTotal: number; description: string }
  | { ok: false; error: string };

/**
 * Prices a catalogue basket **from the database**, never from the request.
 *
 * The client sends `{ productId, quantity }` and nothing else — there is no
 * price field on the wire to ignore, which is the point. This function is the
 * only place a `buy_for_me` item price is decided.
 *
 * Three ways it refuses, all of them things a hostile or stale client will do:
 *  - a product id that isn't in this shop (cross-shop basket, or a typo'd id)
 *  - a product that isn't `active` (out of stock / not serving)
 *  - the same product listed twice, which would silently double-charge
 */
export async function priceCatalogueBasket(args: {
  fastify: FastifyInstance;
  shopId: string;
  items: OrderItemInput[];
}): Promise<BasketResult> {
  const { fastify, shopId, items } = args;

  const ids = items.map((i) => i.productId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "The same item is listed twice — use the quantity instead" };
  }

  const products = await fastify.prisma.product.findMany({
    where: { id: { in: ids }, shopId },
    select: { id: true, name: true, price: true, status: true },
  });

  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: PricedLine[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) {
      return { ok: false, error: "One of those items is not on this shop's menu" };
    }
    if (product.status !== "active") {
      return {
        ok: false,
        error: `"${product.name}" is ${product.status === "out_of_stock" ? "out of stock" : "not being served"} right now`,
      };
    }
    lines.push({
      productId: product.id,
      name: product.name,
      unitPrice: Number(product.price),
      quantity: item.quantity,
    });
  }

  const itemsTotal = round2(
    lines.reduce((sum, l) => sum + (l.unitPrice ?? 0) * l.quantity, 0),
  );

  return { ok: true, lines, itemsTotal, description: describeLines(lines) };
}

/**
 * A manual list for a shop that isn't on Wave. Nothing to look up and nothing to
 * price — `unitPrice` stays null until the rider records what they paid.
 */
export function buildManualBasket(items: ManualItemInput[]): BasketResult {
  const lines: PricedLine[] = items.map((i) => ({
    productId: null,
    name: i.name.trim(),
    unitPrice: null,
    quantity: i.quantity,
  }));
  return { ok: true, lines, itemsTotal: 0, description: describeLines(lines) };
}

/**
 * The one-line summary written to `Order.itemDescription`.
 *
 * Derived here rather than accepted from the client so a basket summary can
 * never disagree with the basket it summarises — the rider reads this line on
 * the feed and the items on the detail screen, and they have to be the same
 * order.
 */
export function describeLines(lines: PricedLine[]): string {
  const text = lines.map((l) => `${l.quantity}x ${l.name}`).join(", ");
  return text.length <= 500 ? text : `${text.slice(0, 497)}...`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
