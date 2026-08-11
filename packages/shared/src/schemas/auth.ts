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
