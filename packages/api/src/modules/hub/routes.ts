import type { FastifyInstance, FastifyRequest } from "fastify";
import { HUB_STAGE_COPY, hubAdvanceSchema, runSheetQuerySchema } from "@wave/shared";
import { pushToProfiles } from "../notifications/dispatch";

/**
 * Wave's packing point (owner, 2026-11-04): the delivery company brings every
 * order here, Wave packs each into a Wave paper bag, and Wave takes them to the
 * checkpoints. Staff move orders through two steps, in batches:
 *
 *   Collecting (rider_assigned) → Received, packing (en_route) → Ready at
 *   checkpoint (at_checkpoint)
 *
 * Each step tells the student in Wave's own words. The student closes the
 * order with "I have my order"; staff can force-deliver from the order page.
 */
const HUB_SELECT = {
  id: true,
  status: true,
  orderType: true,
  itemDescription: true,
  scheduledDate: true,
  studentId: true,
  shop: { select: { name: true } },
  suggestion: { select: { name: true } },
  originCheckpoint: { select: { name: true } },
  checkpoint: { select: { id: true, name: true } },
  university: { select: { name: true } },
  student: { select: { fullName: true } },
} as const;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function hubRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  /** The day at the packing point, by stage. */
  fastify.get("/hub", { preHandler: fastify.requirePermission("hub.manage") }, async (request, reply) => {
    const parsed = runSheetQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Use a date like 2026-11-04" });
    const date = parsed.data.date ?? todayUtc();
    const campus = request.user?.campusId;
    const orders = await fastify.prisma.order.findMany({
      where: {
        scheduledDate: new Date(date),
        companyId: { not: null },
        status: { in: ["rider_assigned", "en_route", "at_checkpoint", "delivered"] },
        ...(campus ? { universityId: campus } : {}),
      },
      select: HUB_SELECT,
      orderBy: [{ checkpointId: "asc" }, { createdAt: "asc" }],
    });
    const rows = orders.map(({ studentId: _s, ...o }) => ({ ...o, ref: o.id.slice(0, 8).toUpperCase() }));
    return reply.send({
      date,
      collecting: rows.filter((o) => o.status === "rider_assigned"),
      packing: rows.filter((o) => o.status === "en_route"),
      ready: rows.filter((o) => o.status === "at_checkpoint"),
      delivered: rows.filter((o) => o.status === "delivered"),
    });
  });

  async function advance(
    request: FastifyRequest,
    from: "rider_assigned" | "en_route",
    to: "en_route" | "at_checkpoint",
  ) {
    const parsed = hubAdvanceSchema.safeParse(request.body);
    if (!parsed.success) return { code: 400, body: { error: "Choose at least one order" } };
    const campus = request.user?.campusId;
    const where = {
      id: { in: parsed.data.orderIds },
      status: from,
      companyId: { not: null },
      ...(campus ? { universityId: campus } : {}),
    };
    // Read first so only the orders that actually move get told, and the
    // status predicate on the update is the lock against a double press.
    const moving = await fastify.prisma.order.findMany({
      where,
      select: { id: true, studentId: true, checkpoint: { select: { name: true } } },
    });
    if (moving.length === 0) return { code: 409, body: { error: "None of those orders are at that step" } };
    const ids = moving.map((o) => o.id);
    const res = await fastify.prisma.order.updateMany({ where: { ...where, id: { in: ids } }, data: { status: to } });
    await fastify.prisma.orderStatusHistory.createMany({
      data: ids.map((orderId) => ({
        orderId,
        status: to,
        changedBy: request.user!.id,
        note: to === "en_route" ? "Received at the packing point" : "Packed and at the checkpoint",
      })),
    });
    await request.audit({
      action: to === "en_route" ? "hub.received" : "hub.ready",
      category: "order",
      entityType: "order",
      entityId: ids[0],
      metadata: { count: ids.length, orderIds: ids },
    });
    const copy = HUB_STAGE_COPY[to];
    for (const o of moving) {
      await pushToProfiles({
        fastify,
        log: request.log,
        profileIds: [o.studentId],
        payload: {
          title: copy.title,
          body: copy.body.replace("{checkpoint}", o.checkpoint?.name ?? "your checkpoint"),
          data: { orderId: o.id },
        },
      });
    }
    return { code: 200, body: { moved: res.count } };
  }

  /** The company dropped these off: they are being packed. */
  fastify.post("/hub/received", { preHandler: fastify.requirePermission("hub.manage") }, async (request, reply) => {
    const r = await advance(request, "rider_assigned", "en_route");
    return reply.code(r.code).send(r.body);
  });

  /** Packed in Wave bags and at their checkpoints. */
  fastify.post("/hub/ready", { preHandler: fastify.requirePermission("hub.manage") }, async (request, reply) => {
    const r = await advance(request, "en_route", "at_checkpoint");
    return reply.code(r.code).send(r.body);
  });
}
