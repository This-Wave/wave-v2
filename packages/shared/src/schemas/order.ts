import { z } from "zod";
import { DELIVERY_DAYS, ORDER_TYPES } from "../constants/platform";

/**
 * Wave places two kinds of order and they need mutually exclusive fields:
 *
 *   buy_for_me — a runner buys from `shopId` and delivers to `checkpointId`.
 *   pickup     — a runner collects from `originCheckpointId` and carries it to
 *                `checkpointId`. No shop, no product, no item cost.
 *
 * The refinements below are the only thing standing between "pickup" and an
 * order with no origin, so they mirror the CHECK constraint in
 * 20260807150000_package_pickup_orders exactly. Change one, change both.
 */
export const createOrderSchema = z
  .object({
    orderType: z.enum(ORDER_TYPES).default("buy_for_me"),
    shopId: z.string().uuid().optional(),
    originCheckpointId: z.string().uuid().optional(),
    checkpointId: z.string().uuid(),
    productId: z.string().uuid().optional(),
    itemDescription: z.string().min(1).max(500),
    deliveryDay: z.enum(DELIVERY_DAYS),
    scheduledDate: z.string().date(),
    isSpecialOrder: z.boolean().default(false),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => (v.orderType === "buy_for_me" ? !!v.shopId : true), {
    message: "shopId is required for a buy_for_me order",
    path: ["shopId"],
  })
  .refine((v) => (v.orderType === "pickup" ? !v.shopId && !v.productId : true), {
    message: "A pickup order has no shop and no product",
    path: ["shopId"],
  })
  .refine((v) => (v.orderType === "pickup" ? !!v.originCheckpointId : true), {
    message: "originCheckpointId is required for a pickup order",
    path: ["originCheckpointId"],
  })
  .refine((v) => (v.orderType === "buy_for_me" ? !v.originCheckpointId : true), {
    message: "A buy_for_me order collects from the shop, not a checkpoint",
    path: ["originCheckpointId"],
  })
  .refine((v) => v.originCheckpointId !== v.checkpointId, {
    message: "Collection and drop-off cannot be the same checkpoint",
    path: ["originCheckpointId"],
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

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
