import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createClient } from "@supabase/supabase-js";
import fp from "fastify-plugin";
import type { Env } from "../config/env";

// Roles mirror `profiles.role` in packages/db/prisma/schema.prisma.
export type Role = "student" | "rider" | "shop_owner" | "admin";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; role: Role };
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  const env = fastify.config as Env;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.code(401).send({ error: "Missing bearer token" });
      }

      const token = authHeader.slice("Bearer ".length);
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        return reply.code(401).send({ error: "Invalid or expired token" });
      }

      const profile = await fastify.prisma.profile.findUnique({
        where: { id: data.user.id },
        select: { id: true, role: true },
      });
      if (!profile) {
        return reply.code(401).send({ error: "No profile for authenticated user" });
      }

      request.user = { id: profile.id, role: profile.role as Role };
    },
  );

  fastify.decorate("requireRole", (...roles: Role[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user || !roles.includes(request.user.role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }
    };
  });
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: Role[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
