import type { FastifyInstance } from "fastify";
import {
  STAFF_ROLES,
  addStaffSchema,
  changeStaffRoleSchema,
  permissionsFor,
  removeStaffSchema,
  toGhanaE164,
} from "@wave/shared";

/**
 * Who works at Wave, and as what. Owner only (`staff.manage`).
 *
 * A person is added by the phone number they already sign in with, so staff
 * never get a second account or a shared password: the Wave login they have
 * becomes a staff login. The cost is that one profile holds one role — a
 * student made staff stops being a student until they are removed.
 *
 * Every change here is audited with before and after, and three things are
 * refused outright because each would be unrecoverable from the dashboard:
 * changing your own role, removing yourself, and leaving Wave with no owner.
 */
export async function staffRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  /** Any staff member: who am I, and what may I do. Drives the admin nav. */
  fastify.get("/me", { preHandler: fastify.requireRole("admin") }, async (request, reply) => {
    const staffRole = request.user!.staffRole ?? null;
    return reply.send({ staffRole, permissions: permissionsFor(staffRole) });
  });

  fastify.get("/", { preHandler: fastify.requirePermission("staff.manage") }, async (_request, reply) => {
    const staff = await fastify.prisma.profile.findMany({
      where: { role: "admin" },
      orderBy: [{ staffRole: "asc" }, { fullName: "asc" }],
      select: { id: true, fullName: true, phone: true, staffRole: true, isActive: true, createdAt: true, updatedAt: true },
    });
    return reply.send({ staff, roles: STAFF_ROLES });
  });

  fastify.post("/", { preHandler: fastify.requirePermission("staff.manage") }, async (request, reply) => {
    const parsed = addStaffSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const phone = toGhanaE164(parsed.data.phone);
    const person = await fastify.prisma.profile.findUnique({
      where: { phone },
      select: { id: true, role: true, staffRole: true, fullName: true, isActive: true },
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

    const updated = await fastify.prisma.profile.update({
      where: { id: person.id },
      data: { role: "admin", staffRole: parsed.data.staffRole },
      select: { id: true, fullName: true, phone: true, staffRole: true, isActive: true, createdAt: true, updatedAt: true },
    });
    await request.audit({
      action: "staff.added",
      category: "staff",
      entityType: "profile",
      entityId: person.id,
      before: { role: person.role, staffRole: null },
      after: { role: "admin", staffRole: updated.staffRole },
      metadata: { name: person.fullName },
    });
    return reply.code(201).send({ staff: updated });
  });

  fastify.patch("/:id", { preHandler: fastify.requirePermission("staff.manage") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = changeStaffRoleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Choose a staff role" });
    if (id === request.user!.id) {
      return reply.code(400).send({ error: "You can't change your own role. Ask another owner." });
    }

    const target = await fastify.prisma.profile.findUnique({
      where: { id },
      select: { role: true, staffRole: true, fullName: true },
    });
    if (!target || target.role !== "admin") return reply.code(404).send({ error: "Not a staff member" });

    if (target.staffRole === "owner" && parsed.data.staffRole !== "owner" && (await ownerCount(fastify)) <= 1) {
      await request.audit({
        action: "staff.last_owner_protected",
        category: "staff",
        entityType: "profile",
        entityId: id,
        outcome: "denied",
      });
      return reply.code(409).send({ error: "Wave needs at least one owner" });
    }

    const updated = await fastify.prisma.profile.update({
      where: { id },
      data: { staffRole: parsed.data.staffRole },
      select: { id: true, fullName: true, phone: true, staffRole: true, isActive: true, createdAt: true, updatedAt: true },
    });
    await request.audit({
      action: "staff.role_changed",
      category: "staff",
      entityType: "profile",
      entityId: id,
      before: { staffRole: target.staffRole },
      after: { staffRole: updated.staffRole },
      metadata: { name: target.fullName },
    });
    return reply.send({ staff: updated });
  });

  fastify.delete("/:id", { preHandler: fastify.requirePermission("staff.manage") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = removeStaffSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Say what they go back to being" });
    if (id === request.user!.id) {
      return reply.code(400).send({ error: "You can't remove yourself. Ask another owner." });
    }

    const target = await fastify.prisma.profile.findUnique({
      where: { id },
      select: { role: true, staffRole: true, fullName: true },
    });
    if (!target || target.role !== "admin") return reply.code(404).send({ error: "Not a staff member" });
    if (target.staffRole === "owner" && (await ownerCount(fastify)) <= 1) {
      return reply.code(409).send({ error: "Wave needs at least one owner" });
    }

    await fastify.prisma.profile.update({
      where: { id },
      data: { role: parsed.data.revertTo, staffRole: null },
    });
    await request.audit({
      action: "staff.removed",
      category: "staff",
      entityType: "profile",
      entityId: id,
      before: { role: "admin", staffRole: target.staffRole },
      after: { role: parsed.data.revertTo, staffRole: null },
      metadata: { name: target.fullName },
    });
    return reply.code(204).send();
  });
}

function ownerCount(fastify: FastifyInstance): Promise<number> {
  return fastify.prisma.profile.count({ where: { role: "admin", staffRole: "owner", isActive: true } });
}
