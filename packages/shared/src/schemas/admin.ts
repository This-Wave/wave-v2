import { z } from "zod";

export const updateConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;

export const refundOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;
