import { z } from "zod";
import { DELIVERY_DAYS } from "../constants/platform";

export const createOrderSchema = z.object({
  shopId: z.string().uuid(),
  checkpointId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  itemDescription: z.string().min(1).max(500),
  deliveryDay: z.enum(DELIVERY_DAYS),
  scheduledDate: z.string().date(),
  isSpecialOrder: z.boolean().default(false),
  notes: z.string().max(500).optional(),
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
