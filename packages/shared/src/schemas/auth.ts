import { z } from "zod";
import { PROFILE_ROLES } from "../constants/platform";

export const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(9).max(15),
  password: z.string().min(8),
  role: z.enum(PROFILE_ROLES),
  universityId: z.string().uuid().optional(),
  studentId: z.string().optional(),
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
