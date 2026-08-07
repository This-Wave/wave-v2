import { z } from "zod";

/**
 * A student naming a shop Wave doesn't carry yet.
 *
 * Deliberately thin. The barrier to telling Wave "you should stock X" has to be
 * a shop name and nothing else — everything past `name` is optional, because a
 * required category field is how you turn a demand signal into an empty table.
 */
export const createShopSuggestionSchema = z.object({
  name: z.string().min(2).max(120),
  locationText: z.string().max(200).optional(),
  category: z.string().max(60).optional(),
});
export type CreateShopSuggestionInput = z.infer<typeof createShopSuggestionSchema>;

/**
 * Admin linking a suggested place to a real shop row that now exists.
 *
 * Keyed by `normalizedName`, not by suggestion id, because onboarding one shop
 * resolves EVERY student who asked for it — that whole group is the point of
 * the ranking, and they all get told at once.
 */
export const resolveShopSuggestionSchema = z.object({
  normalizedName: z.string().min(1).max(120),
  universityId: z.string().uuid(),
  shopId: z.string().uuid(),
});
export type ResolveShopSuggestionInput = z.infer<typeof resolveShopSuggestionSchema>;

export const rejectShopSuggestionSchema = z.object({
  normalizedName: z.string().min(1).max(120),
  universityId: z.string().uuid(),
});
export type RejectShopSuggestionInput = z.infer<typeof rejectShopSuggestionSchema>;
