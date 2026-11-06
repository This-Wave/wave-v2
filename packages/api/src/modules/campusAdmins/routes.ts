import type { FastifyInstance } from "fastify";
import { addCampusAdminSchema, removeStaffSchema, toGhanaE164 } from "@wave/shared";

const CAMPUS_ADMIN_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  adminUniversity: { select: { id: true, name: true } },
} as const;

/**
 * University admins: people who run one campus. Owner and Support only
 * (`campus_admins.manage`).
 *
 * Adding someone here *is* the approval — only an HQ role that holds this
 * permission can do it, and the act is written to the audit log with who did
 * it. There is no second step.
 *
 * Like HQ staff, they are added by the phone number they already sign in
 * with, and while they are a campus admin that account stops being a student,
 * rider or shop account.
 */
export async function campusAdminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermission("campus_admins.manage"));

  fastify.get("/", async (_request, reply) => {
    const [admins, universities] = await Promise.all([
      fastify.prisma.profile.findMany({
        where: { role: "admin", staffRole: "campus_admin" },
        orderBy: [{ adminUniversityId: "asc" }, { fullName: "asc" }],
        select: CAMPUS_ADMIN_SELECT,
      }),
      fastify.prisma.university.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return reply.send({ admins, universities });
  });

  fastify.post("/", async (request, reply) => {
    const parsed = addCampusAdminSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const university = await fastify.prisma.university.findUnique({
      where: { id: parsed.data.universityId },
      select: { id: true, name: true, isActive: true },
    });
    if (!university?.isActive) return reply.code(400).send({ error: "Unknown university" });

    const person = await fastify.prisma.profile.findUnique({
      where: { phone: toGhanaE164(parsed.data.phone) },
      select: { id: true, role: true, fullName: true, isActive: true },
    });
    if (!person) {
      return reply.code(404).send({
        error: "Nobody has signed up with that number. Ask them to create a Wave account first.",
      });
    }
    if (person.role === "admin") {
      return reply.code(409).send({ error: `${person.fullName} is already staff` });
    }
    if (!person.isActive) {
      return reply.code(409).send({ error: "That account is banned. Reactivate it on the Users page first." });
    }

    const admin = await fastify.prisma.profile.update({
      where: { id: person.id },
      data: { role: "admin", staffRole: "campus_admin", adminUniversityId: university.id },
      select: CAMPUS_ADMIN_SELECT,
    });
    await request.audit({
      action: "campus_admin.approved",
      category: "staff",
      entityType: "profile",
      entityId: person.id,
      universityId: university.id,
      before: { role: person.role },
      after: { role: "admin", staffRole: "campus_admin", university: university.name },
      metadata: { name: person.fullName },
    });
    return reply.code(201).send({ admin });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = removeStaffSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Say what they go back to being" });

    const target = await fastify.prisma.profile.findUnique({
      where: { id },
      select: { role: true, staffRole: true, fullName: true, adminUniversityId: true },
    });
    if (!target || target.role !== "admin" || target.staffRole !== "campus_admin") {
      return reply.code(404).send({ error: "Not a campus admin" });
    }

    await fastify.prisma.profile.update({
      where: { id },
      data: { role: parsed.data.revertTo, staffRole: null, adminUniversityId: null },
    });
    await request.audit({
      action: "campus_admin.removed",
      category: "staff",
      entityType: "profile",
      entityId: id,
      universityId: target.adminUniversityId,
      before: { role: "admin", staffRole: "campus_admin" },
      after: { role: parsed.data.revertTo },
      metadata: { name: target.fullName },
    });
    return reply.code(204).send();
  });
}
