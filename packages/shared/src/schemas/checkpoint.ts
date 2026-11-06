import { z } from "zod";

export const createCheckpointSchema = z.object({
  universityId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  /** Set = a pickup point in that city zone; null = a campus drop-off point. */
  zoneId: z.string().uuid().nullable().optional(),
});
export type CreateCheckpointInput = z.infer<typeof createCheckpointSchema>;

export const updateCheckpointSchema = createCheckpointSchema.partial().extend({
  isActive: z.boolean().optional(),
  /**
   * Whether a rider from outside the university may deliver here.
   *
   * Update-only, and false in the database by default. Creating a checkpoint
   * already open to outsiders should take a second, deliberate action rather
   * than being a field someone fills in without noticing.
   */
  externalRidersAllowed: z.boolean().optional(),
});
export type UpdateCheckpointInput = z.infer<typeof updateCheckpointSchema>;

/**
 * An HQ edit to a city pricing zone. The fee is the whole delivery fee for a
 * pickup collected in the zone, so it has the same sane bounds as the base fee.
 */
export const updateZoneSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    deliveryFee: z
      .number({ invalid_type_error: "Zone fee (GH₵) must be a number" })
      .min(1, "Zone fee must be at least GH₵1")
      .max(1000, "Zone fee can't be more than GH₵1,000"),
    isActive: z.boolean().optional(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" });
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
