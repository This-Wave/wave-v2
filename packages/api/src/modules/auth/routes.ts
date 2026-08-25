import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { Webhook, WebhookVerificationError } from "standardwebhooks";
import { loginSchema, registerSchema } from "@wave/shared";
import { createServerSupabaseClient } from "../../lib/supabaseServer";
import { phoneMatchesSession, resolveSupabaseUser } from "../../lib/authUser";
import { SmsSendError, sendOtpSms } from "../../lib/sms";
import { captureSmsError } from "../../lib/sentry";
import {
  LOGIN_RATE_LIMIT,
  REGISTER_RATE_LIMIT,
  SMS_HOOK_RATE_LIMIT,
} from "../../plugins/rateLimit";

export async function authRoutes(fastify: FastifyInstance) {
  const supabase = createServerSupabaseClient(
    fastify.config.SUPABASE_URL,
    fastify.config.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Register — sets a password on a phone number the caller has already proven
  // they control, then creates the matching Prisma profile.
  //
  // This used to call `admin.createUser({ phone, password, phone_confirm: true })`
  // on an unauthenticated request (review 01-cybersecurity, H1). `phone_confirm:
  // true` asserts "this number is verified" on nothing but the caller's say-so,
  // and the consequence is worse than a junk account: register with someone
  // else's number and you own the Supabase user for it. When the real owner
  // later signs in by OTP, Supabase matches that same user and drops them into
  // the attacker's account — and the attacker still knows the password. That is
  // account takeover by pre-registration.
  //
  // The proof is a bearer token from an OTP-verified session, which is exactly
  // what `signInWithOtp` + `verifyOtp` already mints for the phone-signup path.
  // Supabase generated and checked that code, so the number is confirmed
  // because it was confirmed, not because we said so.
  await fastify.register(
    async (scoped) => {
      await scoped.register(rateLimit, REGISTER_RATE_LIMIT);
      scoped.post("/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const { fullName, phone, password, role, universityId, studentId, email } = parsed.data;

    const user = await resolveSupabaseUser(fastify, request.headers.authorization);
    if (!user) {
      return reply.code(401).send({
        error: "Verify your phone number before setting a password",
      });
    }
    // The whole point: a valid token proves you own *some* number, not this
    // one. Without this comparison a caller could verify their own phone and
    // register a profile against anyone else's.
    if (!phoneMatchesSession(user.phone, phone)) {
      return reply.code(403).send({
        error: "That phone number does not match your verified session",
      });
    }

    // One profile per auth user. Also stops a second call from silently
    // resetting the password on an account that already exists.
    const existing = await fastify.prisma.profile.findUnique({ where: { id: user.id } });
    if (existing) {
      return reply.code(409).send({ error: "Profile already exists" });
    }

    const { error: passwordError } = await supabase.auth.admin.updateUserById(user.id, {
      password,
    });
    if (passwordError) {
      return reply.code(400).send({ error: passwordError.message });
    }

    try {
      const profile = await fastify.prisma.profile.create({
        data: {
          id: user.id,
          fullName,
          phone,
          role,
          universityId,
          studentId,
          email,
          isVerified: role === "student", // riders/shops require admin verification
        },
      });
      return reply.code(201).send({ profile });
    } catch (err) {
      // No auth user to roll back any more — it predates this request and the
      // caller is still legitimately signed in to it. Only the password was
      // set, which is harmless without a profile: every app route requires one.
      fastify.log.error(err);
      return reply.code(500).send({ error: "Failed to create profile" });
    }
      });
    },
  );

  await fastify.register(
    async (scoped) => {
      await scoped.register(rateLimit, LOGIN_RATE_LIMIT);
      scoped.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const { phone, password } = parsed.data;

    const { data, error } = await supabase.auth.signInWithPassword({ phone, password });
    if (error || !data.session) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    return reply.send({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
      });
    },
  );

  // NOTE: there is deliberately no /refresh and no /logout here.
  //
  // Both existed with zero callers. Session lifecycle belongs entirely to the
  // Supabase client SDK, which the mobile app and the admin app both use
  // directly — it refreshes on its own schedule and signs out through
  // `lib/auth.ts` (the only place allowed to call supabase.auth.signOut, so the
  // push token is detached first). A second, server-side path to end a session
  // would have bypassed that and left a signed-out device still receiving
  // notifications.

  // Supabase Auth's "Send SMS Hook" — Supabase itself still generates,
  // stores, and verifies the OTP (via signInWithOtp/verifyOtp on the
  // client, unchanged); this endpoint's only job is delivering the code via
  // mNotify instead of a built-in provider. Auth'd by Standard Webhooks
  // signature (configured in Supabase dashboard → Auth → Hooks), not by
  // fastify.authenticate — Supabase itself is the caller, not a Wave user.
  await fastify.register(
    async (scoped) => {
      await scoped.register(rateLimit, SMS_HOOK_RATE_LIMIT);
      scoped.post(
        "/sms-hook",
        { config: { rawBody: true } },
        async (request, reply) => {
      const rawSecret = fastify.config.SMS_HOOK_SECRET;
      const mnotifyApiKey = fastify.config.MNOTIFY_API_KEY;
      if (!rawSecret || !mnotifyApiKey) {
        request.log.error("SMS hook called but SMS_HOOK_SECRET/MNOTIFY_API_KEY not configured");
        return reply.code(500).send({ error: "SMS hook not configured" });
      }

      let payload: { user: { phone: string }; sms: { otp: string } };
      try {
        const webhook = new Webhook(rawSecret.replace(/^v1,/, ""));
        payload = webhook.verify(request.rawBody!, request.headers as Record<string, string>) as typeof payload;
      } catch (err) {
        if (err instanceof WebhookVerificationError) {
          return reply.code(401).send({ error: "Invalid webhook signature" });
        }
        throw err;
      }

      try {
        await sendOtpSms({
          apiKey: mnotifyApiKey,
          senderId: fastify.config.MNOTIFY_SENDER_ID,
          phone: payload.user.phone,
          otp: payload.sms.otp,
        });
      } catch (err) {
        // Never log the raw axios error — its `config.data` is the SMS body,
        // which contains the OTP in plaintext. SmsSendError omits it.
        const detail = err instanceof SmsSendError ? err.message : "unknown SMS failure";
        request.log.error({ detail }, "mNotify OTP send failed");
        captureSmsError(err, { phase: "sms_hook" });
        return reply.code(500).send({ error: "Failed to send SMS" });
      }

      return reply.code(200).send({});
        },
      );
    },
  );
}
