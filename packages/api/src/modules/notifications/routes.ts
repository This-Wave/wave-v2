import type { FastifyInstance } from "fastify";
import { registerPushTokenSchema } from "@wave/shared";

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
}
