import { z } from "zod";
import { PRODUCT_STATUSES } from "../constants/platform";

export const createShopSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  category: z.string().min(1).max(60),
  phone: z.string().min(9).max(15).optional(),
  locationText: z.string().max(255).optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
});
export type CreateShopInput = z.infer<typeof createShopSchema>;

// `isActive` is update-only: a shop is created active, and pausing it is a
// deliberate later action. This is what backs the "Serving" toggle in the shop
// owner's settings — pausing hides the storefront from students without
// deleting anything.
export const updateShopSchema = createShopSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateShopInput = z.infer<typeof updateShopSchema>;

export const createProductSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().optional(),
  category: z.string().max(60).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductStatusSchema = z.object({
  status: z.enum(PRODUCT_STATUSES),
});
export type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>;
