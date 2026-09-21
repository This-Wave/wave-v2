import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import {
  SERVICE_SWITCHES,
  isServiceSwitchKey,
  resolveServiceStatus,
  serviceForOrderType,
  type ServiceState,
} from "@wave/shared";
import { z } from "zod";
import { recordAudit, SYSTEM_ACTOR } from "../../lib/audit";
import { campusOf, inCampus } from "../../lib/scope";

const SWITCH_SELECT = {
  key: true,
  universityId: true,
  paused: true,
  message: true,
  resumeAt: true,
} as const;

/**
 * Whether a new order of this type may start at this campus. `null` when it
 * may; the pause state (with the student-facing message) when it may not.
 *
 * Called from every door a new order comes in by — order creation, group
 * baskets, and the first payment — so a pause cannot be walked around by using
 * the other one.
 */
export async function pausedFor(
  fastify: FastifyInstance,
  universityId: string | null | undefined,
  orderType: string,
): Promise<ServiceState | null> {
  const rows = await fastify.prisma.serviceSwitch.findMany({
    where: { OR: [{ universityId: null }, ...(universityId ? [{ universityId }] : [])] },
    select: SWITCH_SELECT,
  });
  const state = resolveServiceStatus(universityId, rows)[serviceForOrderType(orderType)];
  return state.paused ? state : null;
}

/** The body a paused door answers with. 503: the service, not the request, is the problem. */
export function pausedReply(state: ServiceState) {
  return { error: state.message, code: "service_paused", resumeAt: state.resumeAt };
}

/**
 * Anyone, signed in or not, may ask whether Wave is taking orders — the
 * signed-out browse mode needs it, and it says nothing a closed shop door
 * wouldn't.
 */
export async function serviceStatusRoutes(fastify: FastifyInstance) {
  fastify.get("/service-status", async (request, reply) => {
    const { universityId } = request.query as { universityId?: string };
    const rows = await fastify.prisma.serviceSwitch.findMany({
      where: { OR: [{ universityId: null }, ...(universityId ? [{ universityId }] : [])] },
      select: SWITCH_SELECT,
    });
    // Short cache: a pause should reach phones within a minute, not on next launch.
    reply.header("cache-control", "public, max-age=30");
    return reply.send({ status: resolveServiceStatus(universityId ?? null, rows) });
  });
}

const setSwitchSchema = z
  .object({
    key: z.string().refine(isServiceSwitchKey, "Unknown switch"),
    universityId: z.string().uuid().nullable(),
    paused: z.boolean(),
    message: z.string().trim().max(200).nullable().optional(),
    resumeAt: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional()
      .refine((v) => !v || new Date(v).getTime() > Date.now(), "Resume time must be in the future"),
  })
  .strict();

const clearSwitchSchema = z.object({ key: z.string().refine(isServiceSwitchKey), universityId: z.string().uuid() }).strict();

export async function adminSwitchRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/switches", { preHandler: fastify.requirePermission("ops.read") }, async (request, reply) => {
    const campus = campusOf(request);
    const [rows, universities] = await Promise.all([
      fastify.prisma.serviceSwitch.findMany({
        // A campus admin sees the global rows (they apply to their campus too)
        // and their own campus's, never another campus's.
        where: campus ? { OR: [{ universityId: null }, { universityId: campus }] } : {},
        select: { ...SWITCH_SELECT, updatedAt: true, updatedById: true },
      }),
      fastify.prisma.university.findMany({
        where: { isActive: true, ...(campus ? { id: campus } : {}) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return reply.send({ catalogue: SERVICE_SWITCHES, rows, universities, campus });
  });

  fastify.put("/switches", { preHandler: fastify.requirePermission("switches.manage") }, async (request, reply) => {
    const parsed = setSwitchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const { key, universityId, paused } = parsed.data;
    // The every-university switch is HQ's. A campus admin pauses their campus.
    const campus = campusOf(request);
    if (campus && universityId !== campus) {
      return reply.code(403).send({ error: "You can only pause ordering at your own campus" });
    }
    const message = paused ? (parsed.data.message ?? null) : null;
    const resumeAt = paused && parsed.data.resumeAt ? new Date(parsed.data.resumeAt) : null;

    if (universityId) {
      const exists = await fastify.prisma.university.findUnique({ where: { id: universityId }, select: { id: true } });
      if (!exists) return reply.code(400).send({ error: "Unknown university" });
    }

    // Same NULL-in-a-unique-index problem as feature flags: the global row is
    // found and written by hand, a campus row can be upserted.
    const existing = await fastify.prisma.serviceSwitch.findFirst({
      where: { key, universityId },
      select: { id: true, ...SWITCH_SELECT },
    });
    const data = { paused, message, resumeAt, updatedById: request.user!.id };
    const row = existing
      ? await fastify.prisma.serviceSwitch.update({ where: { id: existing.id }, data, select: SWITCH_SELECT })
      : await fastify.prisma.serviceSwitch.create({ data: { key, universityId, ...data }, select: SWITCH_SELECT });

    await request.audit({
      action: paused ? "switch.paused" : "switch.resumed",
      category: "switch",
      entityType: "service_switch",
      entityId: key,
      universityId,
      before: existing
        ? { paused: existing.paused, message: existing.message, resumeAt: existing.resumeAt }
        : { paused: false, note: "no row — running" },
      after: { paused: row.paused, message: row.message, resumeAt: row.resumeAt },
    });
    return reply.send({ switch: row });
  });

  /** Remove a campus override so it follows the global switch again. */
  fastify.delete("/switches", { preHandler: fastify.requirePermission("switches.manage") }, async (request, reply) => {
    const parsed = clearSwitchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Name the switch and the campus" });
    if (!inCampus(request, parsed.data.universityId)) {
      return reply.code(403).send({ error: "You can only change your own campus" });
    }
    const existing = await fastify.prisma.serviceSwitch.findFirst({
      where: { key: parsed.data.key, universityId: parsed.data.universityId },
      select: SWITCH_SELECT,
    });
    await fastify.prisma.serviceSwitch.deleteMany({
      where: { key: parsed.data.key, universityId: parsed.data.universityId },
    });
    await request.audit({
      action: "switch.override_cleared",
      category: "switch",
      entityType: "service_switch",
      entityId: parsed.data.key,
      universityId: parsed.data.universityId,
      before: existing,
      after: { note: "follows the global switch" },
    });
    return reply.code(204).send();
  });
}

/**
 * Tidy pauses whose `resumeAt` has passed. They already read as running —
 * `resolveSwitch` ignores an expired pause — so this only exists to flip the
 * row and put the resumption in the audit log, where "who turned ordering back
 * on?" would otherwise have no answer.
 */
export async function resumeExpiredPauses(args: { fastify: FastifyInstance; log: FastifyBaseLogger }) {
  const { fastify, log } = args;
  const expired = await fastify.prisma.serviceSwitch.findMany({
    where: { paused: true, resumeAt: { lte: new Date() } },
    select: { id: true, ...SWITCH_SELECT },
  });
  for (const row of expired) {
    const flipped = await fastify.prisma.serviceSwitch.updateMany({
      where: { id: row.id, paused: true },
      data: { paused: false, message: null, resumeAt: null, updatedById: null },
    });
    if (flipped.count === 0) continue;
    await recordAudit(fastify, {
      action: "switch.auto_resumed",
      category: "switch",
      entityType: "service_switch",
      entityId: row.key,
      universityId: row.universityId,
      before: { paused: true, message: row.message, resumeAt: row.resumeAt },
      after: { paused: false },
      actor: SYSTEM_ACTOR,
    });
    log.info({ key: row.key, universityId: row.universityId }, "Service pause lifted on schedule");
  }
}
