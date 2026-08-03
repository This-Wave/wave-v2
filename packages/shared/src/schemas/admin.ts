import { z } from "zod";
import { PROFILE_ROLES } from "../constants/platform";

export const updateConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
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
