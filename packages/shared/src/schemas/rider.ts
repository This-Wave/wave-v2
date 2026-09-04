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

/**
 * The extra evidence an external rider provides.
 *
 * A student rider is already tied to the institution — the campus knows who
 * they are and where to find them. Someone hired from outside has no such tie,
 * so the evidence has to stand on its own.
 *
 * Optional here and required by the API, which is the only layer that knows the
 * submitting rider's type. Putting the requirement in the schema would mean
 * trusting the client to say which kind of rider it is.
 */
export const externalRiderEvidenceSchema = z.object({
  guarantorName: z.string().min(2).max(120).optional(),
  guarantorPhone: z.string().min(9).max(15).optional(),
  secondIdType: z.enum(RIDER_ID_TYPES).optional(),
  secondIdNumber: z.string().min(1).max(60).optional(),
  secondIdImagePath: verificationImagePath.optional(),
  proofOfAddressPath: verificationImagePath.optional(),
  referenceName: z.string().min(2).max(120).optional(),
  referenceContact: z.string().min(5).max(160).optional(),
});

/** The fields an external rider must supply; checked server-side. */
export const EXTERNAL_RIDER_REQUIRED_FIELDS = [
  "guarantorName",
  "guarantorPhone",
  "secondIdType",
  "secondIdNumber",
  "secondIdImagePath",
  "proofOfAddressPath",
  "referenceName",
  "referenceContact",
] as const;

export const submitVerificationSchema = z
  .object({
    idType: z.enum(RIDER_ID_TYPES),
    idNumber: z.string().min(1).max(60),
    idImagePath: verificationImagePath,
    selfiePath: verificationImagePath,
  })
  .merge(externalRiderEvidenceSchema)
  .superRefine((input, ctx) => {
    // The second ID has to be a different document, or "two forms of ID" is one
    // form of ID entered twice.
    if (input.secondIdType && input.secondIdType === input.idType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondIdType"],
        message: "The second ID must be a different kind of document",
      });
    }
  });
export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;

export const reviewVerificationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().max(500).optional(),
});
export type ReviewVerificationInput = z.infer<typeof reviewVerificationSchema>;

/**
 * The rider's own online/offline toggle.
 *
 * `isAvailable`, NOT `isActive`. This used to write `isActive`, which is the
 * account ban flag the API authenticates against — so a rider going offline
 * got a 403 on their next request and could not turn the toggle back on.
 */
export const setAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;

export const uploadVerificationImageSchema = z.object({
  kind: z.enum(["id", "selfie", "second_id", "proof_of_address"]),
  imageBase64: z.string().min(1),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export type UploadVerificationImageInput = z.infer<typeof uploadVerificationImageSchema>;
