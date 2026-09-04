import { z } from "zod";

export const createCheckpointSchema = z.object({
  universityId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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
