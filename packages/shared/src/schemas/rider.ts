import { z } from "zod";

export const RIDER_ID_TYPES = ["ghana_card", "student_id", "passport"] as const;

export const submitVerificationSchema = z.object({
  idType: z.enum(RIDER_ID_TYPES),
  idNumber: z.string().min(1).max(60),
  idImageUrl: z.string().url(),
  selfieUrl: z.string().url(),
});
export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;

export const reviewVerificationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().max(500).optional(),
});
export type ReviewVerificationInput = z.infer<typeof reviewVerificationSchema>;

export const setAvailabilitySchema = z.object({
  isActive: z.boolean(),
});
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
