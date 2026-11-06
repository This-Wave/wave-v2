import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { Env } from "../config/env";
import { createActivityWatch, describeRequest, type ActivityWatch } from "../lib/activityWatch";

declare module "fastify" {
  interface FastifyInstance {
    /** Null unless TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are both set. */
    activityWatch: ActivityWatch | null;
  }
}

export function watchLabel(user: { fullName?: string; id: string }): string {
  return `Test account: ${user.fullName ?? user.id}`;
}

/** Reports every request a test account makes. See `lib/activityWatch.ts`. */
export default fp(async function watchPlugin(fastify: FastifyInstance) {
  const env = fastify.config as Env;
  const watch = createActivityWatch({
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    log: fastify.log,
  });
  fastify.decorate("activityWatch", watch);
  if (!watch) return;

  fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user?.isTest || request.method === "OPTIONS") return;
    const route = request.routeOptions.url;
    // Sign-out reports itself, immediately.
    if (!route || route === "/v1/auth/signed-out") return;
    watch.record(user.id, watchLabel(user), request.method, describeRequest(request.method, route, reply.statusCode));
  });

  fastify.addHook("onClose", async () => {
    await watch.stop();
  });
});
