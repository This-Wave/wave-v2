import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { RUN_SHEET_STATUSES, assignOrderSchema, runSheetQuerySchema } from "@wave/shared";
import { activeDelivery } from "../companies/mode";
import { notifyOrderStatus, pushToProfiles } from "../notifications/dispatch";

/**
 * The delivery company's dispatcher: one run sheet, one Assign action.
 *
 * Built to be the least work for the company. The dispatcher sees the day's
 * orders for its company, its own riders, and nothing else on Wave — no
 * student phone numbers (riders get those once a job is theirs), no other
 * company's work, no admin data. `role = dispatcher` is not a staff role, so no
 * admin route accepts it.
 *
 * Which orders are on the sheet:
 *  - orders this company already holds (`companyId` = theirs), and
 *  - while this company is the active one, every paid order nobody holds yet.
 */

const RUN_SHEET_SELECT = {
  id: true,
  status: true,
  orderType: true,
  scheduledDate: true,
  itemDescription: true,
  deliveryFee: true,
  riderId: true,
  companyId: true,
  assignedAt: true,
  createdAt: true,
  shop: { select: { id: true, name: true, locationText: true } },
  suggestion: { select: { id: true, name: true } },
  originCheckpoint: { select: { id: true, name: true } },
  checkpoint: { select: { id: true, name: true } },
  university: { select: { id: true, name: true } },
  rider: { select: { id: true, fullName: true } },
  // First name only: the dispatcher needs to tell two orders apart, not to
  // contact the student. The rider gets the phone once the job is theirs.
  student: { select: { fullName: true } },
} as const;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstName(full: string | null | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

export async function dispatchRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("dispatcher"));
  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user?.companyId) {
      return reply.code(403).send({ error: "Your dispatcher account is not linked to a company" });
    }
  });

  /** Orders on the sheet for `date`, scoped to this company. */
  async function sheetOrders(companyId: string, date: string) {
    const delivery = await activeDelivery(fastify);
    const isActiveCompany = delivery.mode === "company" && delivery.company?.id === companyId;
    const scheduledDate = new Date(date);
    const orders = await fastify.prisma.order.findMany({
      where: {
        scheduledDate,
        isTest: false,
        status: { in: [...RUN_SHEET_STATUSES] },
        OR: [
          { companyId },
          ...(isActiveCompany ? [{ companyId: null, riderId: null, status: "confirmed" as const }] : []),
        ],
      },
      select: RUN_SHEET_SELECT,
      orderBy: [{ createdAt: "asc" }],
    });
    return {
      isActiveCompany,
      orders: orders.map(({ student, ...o }) => ({ ...o, studentFirstName: firstName(student?.fullName) })),
    };
  }

  fastify.get("/run-sheet", async (request, reply) => {
    const parsed = runSheetQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Use a date like 2026-11-04" });
    const companyId = request.user!.companyId!;
    const date = parsed.data.date ?? todayUtc();

    const [company, riders, sheet] = await Promise.all([
      fastify.prisma.deliveryCompany.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, isActive: true },
      }),
      fastify.prisma.profile.findMany({
        where: { companyId, role: "rider", isActive: true },
        select: { id: true, fullName: true, phone: true, isAvailable: true },
        orderBy: { fullName: "asc" },
      }),
      sheetOrders(companyId, date),
    ]);
    if (!company) return reply.code(404).send({ error: "Company not found" });

    // Per-rider load, so the dispatcher can spread jobs without counting.
    const open = sheet.orders.filter((o) => o.status !== "delivered");
    const load = new Map<string, number>();
    for (const o of open) if (o.riderId) load.set(o.riderId, (load.get(o.riderId) ?? 0) + 1);

    return reply.send({
      company,
      date,
      // False when Wave has switched back to independent riders or picked
      // another company: the sheet still shows this company's own orders, but
      // no new unassigned ones arrive.
      receivingOrders: sheet.isActiveCompany,
      counts: {
        unassigned: open.filter((o) => !o.riderId).length,
        inProgress: open.filter((o) => !!o.riderId).length,
        delivered: sheet.orders.length - open.length,
      },
      riders: riders.map((r) => ({ ...r, openJobs: load.get(r.id) ?? 0 })),
      orders: sheet.orders,
    });
  });

  /** The same sheet as a CSV, for a company that runs on spreadsheets or paper. */
  fastify.get("/run-sheet.csv", async (request, reply) => {
    const parsed = runSheetQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Use a date like 2026-11-04" });
    const date = parsed.data.date ?? todayUtc();
    const { orders } = await sheetOrders(request.user!.companyId!, date);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Order", "Status", "From", "To", "Campus", "Items", "Student", "Rider"].map(esc).join(","),
      ...orders.map((o) =>
        [
          o.id.slice(0, 8),
          o.status,
          o.shop?.name ?? o.suggestion?.name ?? o.originCheckpoint?.name ?? "",
          o.checkpoint?.name,
          o.university?.name,
          o.itemDescription,
          o.studentFirstName,
          o.rider?.fullName ?? "",
        ]
          .map(esc)
          .join(","),
      ),
    ];
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="wave-run-sheet-${date}.csv"`)
      .send(lines.join("\n"));
  });

  /**
   * Give an order to one of this company's riders. Also re-assigns: moving a
   * job between riders before pickup is the most common dispatcher correction.
   */
  fastify.post("/orders/:id/assign", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = assignOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Choose a rider" });
    const companyId = request.user!.companyId!;

    const rider = await fastify.prisma.profile.findUnique({
      where: { id: parsed.data.riderId },
      select: { id: true, role: true, companyId: true, isActive: true, fullName: true },
    });
    if (!rider || rider.role !== "rider" || rider.companyId !== companyId || !rider.isActive) {
      return reply.code(400).send({ error: "That rider is not on your roster" });
    }

    const order = await fastify.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, riderId: true, companyId: true },
    });
    if (!order) return reply.code(404).send({ error: "Order not found" });

    const delivery = await activeDelivery(fastify);
    const isActiveCompany = delivery.mode === "company" && delivery.company?.id === companyId;
    const ours = order.companyId === companyId;
    const unclaimed = order.companyId === null && order.riderId === null && isActiveCompany;
    if (!ours && !unclaimed) return reply.code(404).send({ error: "Order not found" });

    // Only before pickup. Once a rider is on the way the goods are with them,
    // and moving the job would split who is accountable for them.
    if (order.status !== "confirmed" && order.status !== "rider_assigned") {
      return reply.code(409).send({ error: "This order is already on its way and can't be moved" });
    }
    const previousRiderId = order.riderId;
    if (previousRiderId === rider.id) {
      return reply.code(409).send({ error: `Already assigned to ${rider.fullName}` });
    }

    // The status + rider predicate is the lock: two dispatchers (or one double
    // tap) racing on the same order — only one update can match.
    let updated;
    try {
      updated = await fastify.prisma.order.update({
        where: { id, status: order.status, riderId: previousRiderId },
        data: {
          riderId: rider.id,
          companyId,
          status: "rider_assigned",
          assignedAt: new Date(),
          assignedById: request.user!.id,
        },
        select: RUN_SHEET_SELECT,
      });
    } catch {
      return reply.code(409).send({ error: "Someone changed this order just now. Refresh and try again." });
    }

    await fastify.prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: "rider_assigned",
        changedBy: request.user!.id,
        note: previousRiderId ? "Re-assigned by dispatcher" : "Assigned by dispatcher",
      },
    });
    await request.audit({
      action: previousRiderId ? "order.reassigned" : "order.assigned",
      category: "order",
      entityType: "order",
      entityId: id,
      before: { riderId: previousRiderId },
      after: { riderId: rider.id, companyId },
    });

    // The student hears "a rider is on it" once, on the first assignment only.
    if (!previousRiderId) {
      await notifyOrderStatus({ fastify, log: request.log, orderId: id, status: "rider_assigned" });
    }
    await pushToProfiles({
      fastify,
      log: request.log,
      profileIds: [rider.id],
      payload: { title: "New job assigned", body: updated.itemDescription, data: { orderId: id } },
    });
    if (previousRiderId) {
      await pushToProfiles({
        fastify,
        log: request.log,
        profileIds: [previousRiderId],
        payload: { title: "Job moved", body: "A job was given to another rider.", data: { orderId: id } },
      });
    }

    const { student, ...rest } = updated;
    return reply.send({ order: { ...rest, studentFirstName: firstName(student?.fullName) } });
  });

  /** Take a job back before pickup, so it shows as unassigned again. */
  fastify.post("/orders/:id/unassign", async (request, reply) => {
    const { id } = request.params as { id: string };
    const companyId = request.user!.companyId!;
    const order = await fastify.prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, riderId: true, companyId: true },
    });
    if (!order || order.companyId !== companyId) return reply.code(404).send({ error: "Order not found" });
    if (order.status !== "rider_assigned") {
      return reply.code(409).send({ error: "Only a job that hasn't been picked up can be taken back" });
    }
    try {
      await fastify.prisma.order.update({
        where: { id, status: "rider_assigned", riderId: order.riderId },
        data: { riderId: null, status: "confirmed", assignedAt: null, assignedById: null },
      });
    } catch {
      return reply.code(409).send({ error: "Someone changed this order just now. Refresh and try again." });
    }
    await fastify.prisma.orderStatusHistory.create({
      data: { orderId: id, status: "confirmed", changedBy: request.user!.id, note: "Taken back by dispatcher" },
    });
    await request.audit({
      action: "order.unassigned",
      category: "order",
      entityType: "order",
      entityId: id,
      before: { riderId: order.riderId },
      after: { riderId: null },
    });
    if (order.riderId) {
      await pushToProfiles({
        fastify,
        log: request.log,
        profileIds: [order.riderId],
        payload: { title: "Job taken back", body: "Your dispatcher took a job back.", data: { orderId: id } },
      });
    }
    return reply.send({ ok: true });
  });
}
