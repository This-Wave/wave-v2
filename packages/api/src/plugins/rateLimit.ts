import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";

/** Brute-force guard on password login. */
export const LOGIN_RATE_LIMIT = { max: 10, timeWindow: "15 minutes" as const };

/** Self-serve account creation — expensive (Supabase + profile row). */
export const REGISTER_RATE_LIMIT = { max: 5, timeWindow: "1 hour" as const };

/** Supabase SMS hook — one call per OTP send; cap abuse if hook secret leaks. */
export const SMS_HOOK_RATE_LIMIT = { max: 30, timeWindow: "1 minute" as const };

/** Delivery PIN resend — complements the per-order 60s cooldown. */
export const PIN_RESEND_RATE_LIMIT = { max: 5, timeWindow: "15 minutes" as const };

export default fp(async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    global: false,
    hook: "preHandler",
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
  });
});
