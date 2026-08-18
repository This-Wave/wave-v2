import type { FastifyInstance } from "fastify";
import { completeProfileSchema } from "@wave/shared";
import { createServerSupabaseClient } from "../../lib/supabaseServer";

async function resolveAuthUser(
  fastify: FastifyInstance,
  authHeader: string | undefined,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing bearer token" });
    return null;
  }

  const supabase = createServerSupabaseClient(fastify.config.SUPABASE_URL, fastify.config.SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    reply.code(401).send({ error: "Invalid or expired token" });
    return null;
  }

  return data.user;
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
    const { fullName, role, universityId, studentId, email } = parsed.data;

    const profile = await fastify.prisma.profile.create({
      data: {
        id: user.id,
        phone: user.phone,
        fullName,
        role,
        universityId,
        studentId,
        email,
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
    const body = request.body as {
      fullName?: string;
      avatarUrl?: string;
      email?: string | null;
    };
    const data: { fullName?: string; avatarUrl?: string; email?: string | null } = {};
    if (body.fullName !== undefined) data.fullName = body.fullName;
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;
    if (body.email !== undefined) {
      if (body.email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return reply.code(400).send({ error: "Invalid email address" });
      }
      data.email = body.email;
    }
    const profile = await fastify.prisma.profile.update({
      where: { id: request.user!.id },
      data,
    });
    return reply.send({ profile });
  });
}
