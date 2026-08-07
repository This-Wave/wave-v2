import { z } from "zod";
import {
  DELIVERY_DAYS,
  MAX_ITEM_QUANTITY,
  MAX_ORDER_ITEMS,
  ORDER_TYPES,
} from "../constants/platform";

/**
 * One line of the basket as the client sends it.
 *
 * Note what is NOT here: a price. The client names a product and a quantity;
 * the server reads the price off `products` itself. A client-sent price is the
 * single easiest way to buy a laptop for one pesewa, and CLAUDE.md's rule
 * ("never trust client-sent price") is enforced by this type's shape, not by a
 * comment somewhere in the handler.
 */
export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

/**
 * A line of a manual list, for a shop that isn't on Wave yet. No product to
 * point at and no price anyone knows — the rider fills the price in at the till.
 */
export const manualItemInputSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
});
export type ManualItemInput = z.infer<typeof manualItemInputSchema>;

/**
 * Wave places three kinds of order and they need mutually exclusive fields:
 *
 *   buy_for_me  — a runner buys `items` from `shopId`'s catalogue and delivers
 *                 to `checkpointId`. Prices are known, so it is paid in full up
 *                 front.
 *   pickup      — a runner collects from `originCheckpointId` and carries it to
 *                 `checkpointId`. No shop, no items, no item cost.
 *   shop_pickup — a runner buys a manual list from a shop that is NOT on Wave,
 *                 named by `suggestionId`. No catalogue means no price, so the
 *                 delivery fee is paid now and the goods are charged after the
 *                 rider reports what they actually paid.
 *
 * The refinements below are the only thing standing between "pickup" and an
 * order with no origin, so they mirror the CHECK constraint in
 * 20260807170100_catalogue_and_suggestions exactly. Change one, change both.
 */
export const createOrderSchema = z
  .object({
    orderType: z.enum(ORDER_TYPES).default("buy_for_me"),
    shopId: z.string().uuid().optional(),
    originCheckpointId: z.string().uuid().optional(),
    suggestionId: z.string().uuid().optional(),
    checkpointId: z.string().uuid(),
    items: z.array(orderItemInputSchema).max(MAX_ORDER_ITEMS).optional(),
    manualItems: z.array(manualItemInputSchema).max(MAX_ORDER_ITEMS).optional(),
    deliveryDay: z.enum(DELIVERY_DAYS),
    scheduledDate: z.string().date(),
    isSpecialOrder: z.boolean().default(false),
    notes: z.string().max(500).optional(),
    /**
     * Only a `pickup` sets this — it is the description of the package being
     * moved. For the other two types the server builds it from the item list,
     * so that no caller can write a basket summary that disagrees with the
     * basket.
     */
    itemDescription: z.string().min(1).max(500).optional(),
  })
  // --- buy_for_me -----------------------------------------------------------
  .refine((v) => (v.orderType === "buy_for_me" ? !!v.shopId : true), {
    message: "shopId is required for a buy_for_me order",
    path: ["shopId"],
  })
  .refine((v) => (v.orderType === "buy_for_me" ? !!v.items?.length : true), {
    message: "Pick at least one item from the shop",
    path: ["items"],
  })
  .refine(
    (v) => (v.orderType === "buy_for_me" ? !v.originCheckpointId && !v.suggestionId : true),
    {
      message: "A buy_for_me order collects from the shop, not a checkpoint or a suggestion",
      path: ["originCheckpointId"],
    },
  )
  // --- pickup ---------------------------------------------------------------
  .refine((v) => (v.orderType === "pickup" ? !!v.originCheckpointId : true), {
    message: "originCheckpointId is required for a pickup order",
    path: ["originCheckpointId"],
  })
  .refine(
    (v) =>
      v.orderType === "pickup"
        ? !v.shopId && !v.suggestionId && !v.items?.length && !v.manualItems?.length
        : true,
    {
      message: "A pickup order has no shop, no suggestion and no items",
      path: ["shopId"],
    },
  )
  .refine((v) => (v.orderType === "pickup" ? !!v.itemDescription?.trim() : true), {
    message: "Describe the package being moved",
    path: ["itemDescription"],
  })
  // --- shop_pickup ----------------------------------------------------------
  .refine((v) => (v.orderType === "shop_pickup" ? !!v.suggestionId : true), {
    message: "suggestionId is required — a shop_pickup buys from a suggested shop",
    path: ["suggestionId"],
  })
  .refine((v) => (v.orderType === "shop_pickup" ? !!v.manualItems?.length : true), {
    message: "List at least one thing to buy",
    path: ["manualItems"],
  })
  .refine(
    (v) =>
      v.orderType === "shop_pickup"
        ? !v.shopId && !v.originCheckpointId && !v.items?.length
        : true,
    {
      message: "A shop_pickup has no listed shop, no origin checkpoint and no catalogue items",
      path: ["shopId"],
    },
  )
  // --- shared ---------------------------------------------------------------
  .refine((v) => v.originCheckpointId !== v.checkpointId, {
    message: "Collection and drop-off cannot be the same checkpoint",
    path: ["originCheckpointId"],
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * What the rider paid, per line, at a shop that has no catalogue.
 *
 * Sent once, when they are standing at the till. Recording it is what makes a
 * `shop_pickup` chargeable at all — until this arrives the order has a delivery
 * fee and nothing else.
 */
export const recordGoodsCostSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        /**
         * Per unit, not per line. The server multiplies by the recorded
         * quantity — a rider doing that arithmetic on a phone at a till is
         * exactly where a wrong charge comes from.
         */
        actualUnitPrice: z.number().nonnegative().max(10000),
      }),
    )
    .min(1),
});
export type RecordGoodsCostInput = z.infer<typeof recordGoodsCostSchema>;

export const deliverOrderSchema = z.object({
  pin: z.string().length(6).regex(/^\d{6}$/, "PIN must be 6 digits"),
});
export type DeliverOrderInput = z.infer<typeof deliverOrderSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

// Server-side total calculation input — never trust a client-sent total.
export const orderTotalInputSchema = z.object({
  itemPrice: z.number().nonnegative().default(0),
  deliveryFee: z.number().nonnegative(),
  discountPct: z.number().min(0).max(100).default(0),
  surchargePct: z.number().min(0).max(100).default(0),
});
export type OrderTotalInput = z.infer<typeof orderTotalInputSchema>;
