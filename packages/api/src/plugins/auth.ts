import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { Env } from "../config/env";
import { createServerSupabaseClient } from "../lib/supabaseServer";
import { recordAudit } from "../lib/audit";

/**
 * Supabase session ids this process has already logged a sign-in for.
 *
 * Wave never sees a sign-in happen — the app and the admin talk to Supabase
 * directly — so "session started" is recorded the first time the API sees a
 * token carrying a new `session_id`. The set only saves a database lookup; the
 * database check below is what stops a restart from logging every live session
 * twice.
 */
const seenSessions = new Set<string>();
const SEEN_SESSIONS_CAP = 5000;

function sessionIdFromJwt(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { session_id?: unknown };
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}

// Roles mirror `profiles.role` in packages/db/prisma/schema.prisma.
export type Role = "student" | "rider" | "shop_owner" | "admin";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      role: Role;
      fullName?: string;
      universityId?: string | null;
      staffRole?: string | null;
    };
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  const env = fastify.config as Env;
  const supabase = createServerSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

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
        select: { id: true, role: true, isActive: true, fullName: true, universityId: true },
      });
      if (!profile) {
        return reply.code(401).send({ error: "No profile for authenticated user" });
      }
      request.user = {
        id: profile.id,
        role: profile.role as Role,
        fullName: profile.fullName,
        universityId: profile.universityId,
      };
      if (!profile.isActive) {
        // Attributed, so the log shows *which* banned account keeps trying.
        return reply.code(403).send({ error: "Account deactivated" });
      }

      const sessionId = sessionIdFromJwt(token);
      if (sessionId && !seenSessions.has(sessionId)) {
        if (seenSessions.size >= SEEN_SESSIONS_CAP) seenSessions.clear();
        seenSessions.add(sessionId);
        const already = await fastify.prisma.auditEvent.findFirst({
          where: { entityType: "session", entityId: sessionId },
          select: { id: true },
        });
        if (!already) {
          await recordAudit(
            fastify,
            {
              action: "auth.session_started",
              category: "auth",
              entityType: "session",
              entityId: sessionId,
              metadata: { signInMethod: data.user.app_metadata?.provider ?? null },
            },
            request,
          );
          // The session event is not this request's event.
          request.auditRecorded = false;
        }
      }
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
