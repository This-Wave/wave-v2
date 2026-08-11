import type { FastifyInstance } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { completeProfileSchema } from "@wave/shared";

export async function profileRoutes(fastify: FastifyInstance) {
  // No `authenticate` preHandler here on purpose: `authenticate` requires an
  // existing Profile row, but this route's whole job is to create the first
  // one for a Supabase phone-OTP user who has an auth user but no profile yet.
  fastify.post("/", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing bearer token" });
    }

    const supabase = createClient(fastify.config.SUPABASE_URL, fastify.config.SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.slice("Bearer ".length);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }
    if (!data.user.phone) {
      return reply.code(400).send({ error: "Authenticated user has no phone number" });
    }

    const existing = await fastify.prisma.profile.findUnique({ where: { id: data.user.id } });
    if (existing) {
      return reply.code(409).send({ error: "Profile already exists" });
    }

    const parsed = completeProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const { fullName, role, universityId, studentId } = parsed.data;

    const profile = await fastify.prisma.profile.create({
      data: {
        id: data.user.id,
        phone: data.user.phone,
        fullName,
        role,
        universityId,
        studentId,
        isVerified: role === "student",
      },
    });
    return reply.code(201).send({ profile });
  });

  fastify.get("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const profile = await fastify.prisma.profile.findUnique({
      where: { id: request.user!.id },
    });
    return reply.send({ profile });
  });

  fastify.put("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const profile = await fastify.prisma.profile.update({
      where: { id: request.user!.id },
      data: {
        fullName: body.fullName as string | undefined,
        avatarUrl: body.avatarUrl as string | undefined,
      },
    });
    return reply.send({ profile });
  });
}
