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

/**
 * Delivery PIN *entry*, at the checkpoint.
 *
 * The per-order attempt counter on `orders.delivery_pin_attempts` is the real
 * guard — it survives restarts and cannot be outrun by waiting. This is the
 * cheap outer layer: it costs a bcrypt comparison to find out a guess is wrong,
 * so an unbounded caller can burn CPU on the API even while losing.
 *
 * Sized for a rider fumbling digits on a phone in the sun, not for a script.
 */
export const PIN_VERIFY_RATE_LIMIT = { max: 10, timeWindow: "5 minutes" as const };

/**
 * Order creation.
 *
 * Wave runs on Sundays and Wednesdays, so a student places a handful of orders
 * a week, not a handful a minute. Ten an hour leaves ordinary use untouched —
 * including changing your mind and reordering — while capping a script.
 */
export const ORDER_CREATE_RATE_LIMIT = { max: 10, timeWindow: "1 hour" as const };

/**
 * Opening a checkout.
 *
 * Every call creates a real transaction at Paystack, so an uncapped caller is a
 * free way to fill Paystack with noise and pile work onto the abandoned-checkout
 * sweep, which asks Paystack about each stale reference in turn.
 *
 * Deliberately looser than order creation. Re-opening checkout is *normal* here:
 * a student backs out, taps Pay again, or a MoMo prompt times out and they
 * retry. That behaviour is common enough that it has its own recovery path
 * (`metadata.order_id` matching on the webhook). Twenty an hour absorbs a bad
 * afternoon on campus wifi and still stops a loop.
 */
export const PAYMENT_INITIATE_RATE_LIMIT = { max: 20, timeWindow: "1 hour" as const };

/** Shop suggestions — cheap to send, and they land in an admin's queue. */
export const SUGGESTION_RATE_LIMIT = { max: 10, timeWindow: "1 hour" as const };

/**
 * Verification image uploads.
 *
 * These write to Supabase Storage, so an uncapped caller costs real storage. An
 * external rider legitimately submits several — two IDs, a selfie, proof of
 * address — and may retake a blurry one, so the ceiling has to clear that with
 * room rather than punish a bad camera.
 */
export const VERIFICATION_UPLOAD_RATE_LIMIT = { max: 20, timeWindow: "1 hour" as const };

/**
 * Keys a limit by account, falling back to IP only when unauthenticated.
 *
 * **This matters more than the numbers do.** Ashesi's campus wifi NATs the whole
 * university behind a small number of addresses, so an IP-keyed limit on a
 * student route would let one person exhaust the quota for everyone in their
 * hall. Every limit below is per-account for exactly that reason; `@fastify/rate-limit`
 * keys on IP by default, which is the wrong default for this deployment.
 */
export function perAccount(suffix: string) {
  return (request: { user?: { id?: string } | null; ip: string }) =>
    `${request.user?.id ?? request.ip}:${suffix}`;
}

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
