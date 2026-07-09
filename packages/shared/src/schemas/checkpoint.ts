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
});
export type UpdateCheckpointInput = z.infer<typeof updateCheckpointSchema>;
