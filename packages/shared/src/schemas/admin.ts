import { z } from "zod";
import { PROFILE_ROLES } from "../constants/platform";

/**
 * Every `platform_config` key the platform actually reads, with the range its
 * value has to fall in.
 *
 * The schema used to be `{ key: string, value: string }` — any key, any string.
 * Every consumer then does `Number(row.value)`, so one typo in the admin form
 * (`delivery_fee_base = "20 GHS"`) yields `NaN`, and `NaN` propagates silently
 * through `calculateOrderTotal` into `totalAmount`. The student sees a broken
 * checkout and Paystack replies "Invalid Amount Sent"; nothing anywhere names
 * the field that did it. Every one of these is money or eligibility, so the
 * validation belongs at the edge, before the row is written.
 *
 * `max` values are sanity ceilings, not policy — they exist to catch a slipped
 * decimal point, not to express what Wave would charge.
 */
export const PLATFORM_CONFIG_KEYS = {
  delivery_fee_base: { min: 0, max: 500, integer: false, label: "Base delivery fee (GH₵)" },
  special_order_surcharge_pct: { min: 0, max: 200, integer: false, label: "Special order surcharge (%)" },
  loyalty_discount_pct: { min: 0, max: 100, integer: false, label: "Loyalty discount (%)" },
  loyalty_threshold: { min: 1, max: 1000, integer: true, label: "Deliveries before the discount" },
  special_order_lead_hours: { min: 0, max: 720, integer: true, label: "Special order lead time (hours)" },
  goods_cost_max_ghs: { min: 0, max: 100000, integer: false, label: "Max goods total (GH₵)" },
  rider_earning_pct: { min: 0, max: 100, integer: false, label: "Rider share of the delivery fee (%)" },
} as const;

export type PlatformConfigKey = keyof typeof PLATFORM_CONFIG_KEYS;

export const updateConfigSchema = z
  .object({
    key: z.string().min(1),
    value: z.string().min(1),
  })
  .superRefine((input, ctx) => {
    const spec = PLATFORM_CONFIG_KEYS[input.key as PlatformConfigKey];
    if (!spec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["key"],
        message: `Unknown setting. Valid keys: ${Object.keys(PLATFORM_CONFIG_KEYS).join(", ")}`,
      });
      return;
    }
    // `Number("")` is 0 and `Number(" 5 ")` is 5, so test the trimmed string for
    // emptiness first and let Number handle the rest.
    const trimmed = input.value.trim();
    const parsed = trimmed === "" ? Number.NaN : Number(trimmed);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `${spec.label} must be a number`,
      });
      return;
    }
    if (spec.integer && !Number.isInteger(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `${spec.label} must be a whole number`,
      });
      return;
    }
    if (parsed < spec.min || parsed > spec.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `${spec.label} must be between ${spec.min} and ${spec.max}`,
      });
    }
  });
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;

export const refundOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

/**
 * Role reassignment. This is how a verified student becomes a rider, so it is
 * the one admin action that can widen someone's access — it is deliberately a
 * separate endpoint from the general profile update rather than a writable
 * field, so it can never be set by accident from a normal edit.
 */
export const updateUserRoleSchema = z.object({
  role: z.enum(PROFILE_ROLES),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

/** Admins create shops on an owner's behalf, so ownerId is explicit here. */
export const adminCreateShopSchema = z.object({
  ownerId: z.string().uuid(),
  universityId: z.string().uuid(),
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  description: z.string().max(1000).optional(),
  phone: z.string().min(9).max(15).optional(),
  locationText: z.string().max(255).optional(),
});
export type AdminCreateShopInput = z.infer<typeof adminCreateShopSchema>;

export const adminUpdateShopSchema = z
  .object({
    name: z.string().min(1).max(120),
    category: z.string().min(1).max(60),
    description: z.string().max(1000),
    phone: z.string().min(9).max(15),
    locationText: z.string().max(255),
    isActive: z.boolean(),
    isVerified: z.boolean(),
  })
  .partial();
export type AdminUpdateShopInput = z.infer<typeof adminUpdateShopSchema>;
