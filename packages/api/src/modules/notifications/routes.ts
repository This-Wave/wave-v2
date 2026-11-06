import type { FastifyInstance } from "fastify";
import { registerPushTokenSchema, webPushSubscriptionSchema, webPushUnsubscribeSchema } from "@wave/shared";
import { webPushEnabled } from "./webPush";

export async function notificationRoutes(fastify: FastifyInstance) {
  // Registers this device against the signed-in profile. Idempotent — the app
  // calls it on every launch, because Expo can rotate a token at any time and
  // the client has no way to know that it did.
  fastify.post("/token", { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = registerPushTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const { token } = parsed.data;
    const userId = request.user!.id;

    // A shared or resold phone: whoever signed in last owns the device. Without
    // this, the previous account keeps the token and receives push
    // notifications about their orders on someone else's lock screen.
    await fastify.prisma.profile.updateMany({
      where: { pushToken: token, id: { not: userId } },
      data: { pushToken: null },
    });

    await fastify.prisma.profile.update({
      where: { id: userId },
      data: { pushToken: token },
    });

    return reply.send({ registered: true });
  });

  // Called on sign-out. Best-effort on the client, but it matters: the next
  // person to sign in on this device would otherwise get the previous user's
  // notifications until their own registration lands.
  fastify.delete("/token", { preHandler: fastify.authenticate }, async (request, reply) => {
    await fastify.prisma.profile.update({
      where: { id: request.user!.id },
      data: { pushToken: null },
    });
    return reply.send({ registered: false });
  });

  // Public: the app needs the key before anyone signs in to know whether to
  // offer notifications at all. `null` means web push is off on this server.
  fastify.get("/web-push/key", async (_request, reply) => {
    const config = fastify.config;
    return reply.send({ publicKey: webPushEnabled(config) ? config.VAPID_PUBLIC_KEY : null });
  });

  // Idempotent, like `/token`: the app re-sends its subscription on every
  // launch, and a browser can rotate one without telling the page.
  fastify.post("/web-push", { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = webPushSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid subscription", details: parsed.error.flatten() });
    }
    const { endpoint, keys } = parsed.data;
    const profileId = request.user!.id;
    const userAgent = request.headers["user-agent"]?.slice(0, 300) ?? null;

    // Upsert on the endpoint: a browser that signs in as someone else moves to
    // them, so the previous account stops getting pushes on this device.
    await fastify.prisma.webPushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, profileId, userAgent },
      update: { p256dh: keys.p256dh, auth: keys.auth, profileId, userAgent },
    });
    return reply.send({ subscribed: true });
  });

  fastify.delete("/web-push", { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = webPushUnsubscribeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    await fastify.prisma.webPushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, profileId: request.user!.id },
    });
    return reply.send({ subscribed: false });
  });
}
