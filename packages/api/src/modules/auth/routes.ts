import type { FastifyInstance } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { Webhook, WebhookVerificationError } from "standardwebhooks";
import { loginSchema, registerSchema } from "@wave/shared";
import { sendOtpSms } from "./mnotify";

export async function authRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    fastify.config.SUPABASE_URL,
    fastify.config.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Register — creates a Supabase auth user, then a matching Prisma profile.
  // Supabase Auth issues the JWT; Neon/Prisma stores the app-level profile.
  fastify.post("/register", async (request, reply) => {
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

  fastify.post("/login", async (request, reply) => {
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

  fastify.post("/refresh", async (request, reply) => {
    const body = request.body as { refresh_token?: string };
    if (!body.refresh_token) {
      return reply.code(400).send({ error: "refresh_token is required" });
    }
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: body.refresh_token });
    if (error || !data.session) {
      return reply.code(401).send({ error: "Invalid refresh token" });
    }
    return reply.send({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    });
  });

  fastify.post(
    "/logout",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const authHeader = request.headers.authorization!;
      const token = authHeader.slice("Bearer ".length);
      await supabase.auth.admin.signOut(token);
      return reply.send({ success: true });
    },
  );

  // Supabase Auth's "Send SMS Hook" — Supabase itself still generates,
  // stores, and verifies the OTP (via signInWithOtp/verifyOtp on the
  // client, unchanged); this endpoint's only job is delivering the code via
  // mNotify instead of a built-in provider. Auth'd by Standard Webhooks
  // signature (configured in Supabase dashboard → Auth → Hooks), not by
  // fastify.authenticate — Supabase itself is the caller, not a Wave user.
  fastify.post(
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
        request.log.error(err, "mNotify OTP send failed");
        return reply.code(500).send({ error: "Failed to send SMS" });
      }

      return reply.code(200).send({});
    },
  );
}
