import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import rawBody from "fastify-raw-body";
import type { Env } from "../config/env";
import type { Role } from "../plugins/auth";

/**
 * Builds a Fastify instance carrying one route module, with `prisma`, `config`
 * and the auth decorators stubbed.
 *
 * Deliberately not `buildApp()`: that loads real env, opens a Prisma connection
 * to Neon and constructs a Supabase client, so every route test would need a
 * live database and a live auth project to assert on branching that touches
 * neither. This keeps the routes themselves — validation, ordering, status
 * codes — testable in isolation.
 */
export interface HarnessOptions {
  /** Registered as `fastify.prisma`. Give each test only the models it uses. */
  prisma: unknown;
  /** Who `authenticate` resolves to. `null` makes it answer 401. */
  user?: { id: string; role: Role } | null;
  env?: Partial<Env>;
  prefix?: string;
}

export const TEST_PAYSTACK_SECRET = "sk_test_wave_harness";

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: "test",
    PORT: 4000,
    APP_URL: "http://localhost:4000",
    DATABASE_URL: "postgresql://test/test",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_ANON_KEY: "anon",
    PAYSTACK_SECRET_KEY: TEST_PAYSTACK_SECRET,
    JWT_SECRET: "jwt-secret",
    MNOTIFY_SENDER_ID: "Wave",
    // The sweep timer has no place in a route test — see plugins/sweeper.ts.
    SWEEP_ENABLED: false,
    ...overrides,
  } as Env;
}

export async function buildTestApp(
  routes: (fastify: FastifyInstance) => Promise<void>,
  options: HarnessOptions,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.decorate("config", testEnv(options.env));
  app.decorate("prisma", options.prisma as never);

  const user = options.user === undefined ? { id: "test-user", role: "student" as Role } : options.user;

  // Mirrors plugins/auth.ts: authenticate answers 401 and attaches request.user,
  // requireRole answers 403. Same contract, no Supabase round trip.
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!user) {
      await reply.code(401).send({ error: "Missing bearer token" });
      return;
    }
    request.user = user;
  });

  app.decorate("requireRole", (...roles: Role[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user || !roles.includes(request.user.role)) {
        await reply.code(403).send({ error: "Forbidden" });
      }
    };
  });

  // The webhook opts in per-route via `config: { rawBody: true }`, so the
  // signature it verifies is over the exact bytes sent — the whole point of
  // the test below.
  await app.register(rawBody, { field: "rawBody", global: false, runFirst: true });
  await app.register(routes, { prefix: options.prefix ?? "" });
  await app.ready();
  return app;
}
