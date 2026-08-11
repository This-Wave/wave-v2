import { z } from "zod";

export const RIDER_ID_TYPES = ["ghana_card", "student_id", "passport"] as const;

// Paths inside the private "verifications" bucket, as returned by
// POST /riders/verification/upload — not URLs. The API additionally checks the
// path belongs to the calling rider; a URL here used to let a rider point the
// admin review page's <img src> at any host they liked.
const verificationImagePath = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => !/^https?:\/\//i.test(value), { message: "Expected a storage path, not a URL" });

export const submitVerificationSchema = z.object({
  idType: z.enum(RIDER_ID_TYPES),
  idNumber: z.string().min(1).max(60),
  idImagePath: verificationImagePath,
  selfiePath: verificationImagePath,
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

export const uploadVerificationImageSchema = z.object({
  kind: z.enum(["id", "selfie"]),
  imageBase64: z.string().min(1),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export type UploadVerificationImageInput = z.infer<typeof uploadVerificationImageSchema>;
