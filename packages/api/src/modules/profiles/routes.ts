import type { FastifyInstance } from "fastify";
import { completeProfileSchema, updateProfileSchema } from "@wave/shared";
import { resolveSupabaseUser } from "../../lib/authUser";

/**
 * `resolveSupabaseUser` plus the 401 these routes answer with. The resolution
 * itself is shared with `POST /auth/register`, which needs the same
 * profile-less token check.
 */
async function resolveAuthUser(
  fastify: FastifyInstance,
  authHeader: string | undefined,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  const user = await resolveSupabaseUser(fastify, authHeader);
  if (!user) {
    reply.code(401).send({ error: "Invalid or expired token" });
    return null;
  }
  return user;
}

export async function profileRoutes(fastify: FastifyInstance) {
  // No `authenticate` preHandler on POST or GET /me: `authenticate` requires an
  // existing Profile row, but phone-OTP signups have a Supabase user first and
  // create their Profile on ProfileSetupScreen.
  fastify.post("/", async (request, reply) => {
    const user = await resolveAuthUser(fastify, request.headers.authorization, reply);
    if (!user) return;
    if (!user.phone) {
      return reply.code(400).send({ error: "Authenticated user has no phone number" });
    }

    const existing = await fastify.prisma.profile.findUnique({ where: { id: user.id } });
    if (existing) {
      return reply.code(409).send({ error: "Profile already exists" });
    }

    const parsed = completeProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const { fullName, role, universityId, studentId, email, riderType } = parsed.data;

    const profile = await fastify.prisma.profile.create({
      data: {
        id: user.id,
        phone: user.phone,
        fullName,
        role,
        universityId,
        studentId,
        email,
        // Null for every non-rider; the schema rejects it being sent otherwise.
        riderType: role === "rider" ? riderType : null,
        isVerified: role === "student",
      },
    });
    return reply.code(201).send({ profile });
  });

  fastify.get("/me", async (request, reply) => {
    const user = await resolveAuthUser(fastify, request.headers.authorization, reply);
    if (!user) return;

    const profile = await fastify.prisma.profile.findUnique({
      where: { id: user.id },
    });
    return reply.send({ profile });
  });

  fastify.put("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const body = parsed.data;

    // Built key-by-key rather than spread: `exactOptionalPropertyTypes` aside,
    // handing Prisma the parse result wholesale would write `undefined` keys
    // and makes the set of updatable columns implicit. The schema is `.strict()`,
    // so `role` / `isVerified` / `isActive` are rejected before reaching here.
    const data: { fullName?: string; avatarUrl?: string; email?: string | null } = {};
    if (body.fullName !== undefined) data.fullName = body.fullName;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;
    if (body.email !== undefined) data.email = body.email;
    const profile = await fastify.prisma.profile.update({
      where: { id: request.user!.id },
      data,
    });
    return reply.send({ profile });
  });
}
