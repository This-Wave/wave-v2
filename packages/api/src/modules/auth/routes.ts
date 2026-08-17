import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { Webhook, WebhookVerificationError } from "standardwebhooks";
import { loginSchema, registerSchema } from "@wave/shared";
import { createServerSupabaseClient } from "../../lib/supabaseServer";
import { SmsSendError, sendOtpSms } from "../../lib/sms";
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

  // Register — creates a Supabase auth user, then a matching Prisma profile.
  // Supabase Auth issues the JWT; Neon/Prisma stores the app-level profile.
  await fastify.register(
    async (scoped) => {
      await scoped.register(rateLimit, REGISTER_RATE_LIMIT);
      scoped.post("/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const { fullName, phone, password, role, universityId, studentId } = parsed.data;

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
    });
    if (authError || !authUser.user) {
      return reply.code(400).send({ error: authError?.message ?? "Failed to create auth user" });
    }

    try {
      const profile = await fastify.prisma.profile.create({
        data: {
          id: authUser.user.id,
          fullName,
          phone,
          role,
          universityId,
          studentId,
          isVerified: role === "student", // riders/shops require admin verification
        },
      });
      return reply.code(201).send({ profile });
    } catch (err) {
      // Roll back the orphaned auth user if profile creation fails.
      await supabase.auth.admin.deleteUser(authUser.user.id);
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
        return reply.code(500).send({ error: "Failed to send SMS" });
      }

      return reply.code(200).send({});
        },
      );
    },
  );
}
