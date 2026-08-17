import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default("http://localhost:4000"),

  /** Comma-separated browser origins (admin URL, student web URL, localhost dev). Required in production. */
  CORS_ORIGINS: z.string().optional(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Neon.tech, never Supabase DB)"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  // Paystack signs webhooks with an HMAC-SHA512 of this same secret key —
  // there is no separate webhook signing secret to configure.
  PAYSTACK_SECRET_KEY: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("sk_"), "PAYSTACK_SECRET_KEY must be a Paystack secret key (sk_test_… or sk_live_…), not the public pk_… key"),

  JWT_SECRET: z.string().min(1),

  // Real phone OTP delivery: Supabase Auth generates/verifies the code, but
  // delegates the actual SMS send to this Fastify webhook via a "Send SMS
  // Hook" configured in the Supabase dashboard — which then calls mNotify.
  // Optional so the app still boots before this is configured.
  SMS_HOOK_SECRET: z.string().optional(),
  MNOTIFY_API_KEY: z.string().optional(),
  MNOTIFY_SENDER_ID: z.string().max(11).default("Wave"),

  // Transactional email (Resend). Optional like mNotify: unset means every send
  // is a silent no-op, which is what keeps tests and local dev offline. The
  // from-address must be on a domain verified in the Resend dashboard.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default("Wave <notifications@wave.app>"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}
