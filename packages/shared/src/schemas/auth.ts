import { z } from "zod";
import { SELF_SERVE_PROFILE_ROLES } from "../constants/platform";

export const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(9).max(15),
  password: z.string().min(8),
  role: z.enum(SELF_SERVE_PROFILE_ROLES),
  universityId: z.string().uuid().optional(),
  studentId: z.string().optional(),
  // Optional forever — auth is by phone. Only used to reach someone when a
  // shop they suggested goes live.
  email: z.string().email().max(160).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  phone: z.string().min(9).max(15),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Used to create the Prisma profile row after a Supabase phone-OTP signup —
// the auth user already exists at this point, only the app-level profile is missing.
export const completeProfileSchema = z.object({
  fullName: z.string().min(2).max(120),
  role: z.enum(SELF_SERVE_PROFILE_ROLES),
  universityId: z.string().uuid().optional(),
  studentId: z.string().optional(),
  email: z.string().email().max(160).optional(),
});
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

// Self-service edits to an existing profile (PUT /profiles/me). Deliberately
// narrow: `role`, `universityId`, `isVerified` and `isActive` are all
// privilege-bearing and must never be settable by the account holder, so
// `.strict()` rejects them outright rather than letting them be silently
// dropped. Every field is optional — the route applies only what is present.
export const updateProfileSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    // `.url()` alone is not enough: Zod accepts any WHATWG-parseable URL, so
    // `javascript:alert(1)` passes it. That string is then stored and rendered
    // as an avatar `src`/`href` by the admin dashboard — stored XSS. Restrict
    // to the two schemes an image can actually be served over.
    avatarUrl: z
      .string()
      .url()
      .max(500)
      .refine(
        (v) => /^https?:\/\//i.test(v),
        "avatarUrl must be an http(s) URL",
      )
      .optional(),
    // Nullable, unlike register/complete: clearing an email is a legitimate edit.
    email: z.string().email().max(160).nullable().optional(),
  })
  .strict();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
