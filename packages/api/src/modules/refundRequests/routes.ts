import type { FastifyInstance } from "fastify";
import type { RefundRequestStatus } from "@prisma/client";
import { decideRefundSchema, hasPermission, requestRefundSchema } from "@wave/shared";
import { endOrderWithRefund } from "../payments/refund";
import { campusOf, inCampus, outsideCampus } from "../../lib/scope";

const REQUEST_SELECT = {
  id: true,
  status: true,
  reason: true,
  decisionNote: true,
  failureDetail: true,
  createdAt: true,
  decidedAt: true,
  requestedById: true,
  decidedById: true,
  university: { select: { id: true, name: true } },
  order: {
    select: {
      id: true,
      status: true,
      totalAmount: true,
      paidAt: true,
      createdAt: true,
      student: { select: { fullName: true } },
      shop: { select: { name: true } },
    },
  },
} as const;

/**
 * Refunds a campus admin asks for, and HQ decides.
 *
 * The split is the point: a campus admin sees the student in front of them and
 * can say "this one should get their money back", but only an HQ role holding
 * `refunds.approve` (owner, claims officer, accountant) moves money. Approval
 * runs the same `endOrderWithRefund` the direct HQ refund uses, so there is one
 * refund path, not two.
 */
export async function refundRequestRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/", { preHandler: fastify.requirePermission("refunds.request") }, async (request, reply) => {
    const parsed = requestRefundSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const order = await fastify.prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: { id: true, universityId: true, status: true, paidAt: true, goodsPaidAt: true },
    });
    if (!order || !inCampus(request, order.universityId)) return outsideCampus(reply, "Order not found");
    if (order.status === "refunded") return reply.code(409).send({ error: "This order has already been refunded" });
    if (!order.paidAt && !order.goodsPaidAt) {
      return reply.code(409).send({ error: "Nothing was paid on this order, so there is nothing to refund" });
    }

    try {
      const created = await fastify.prisma.refundRequest.create({
        data: {
          orderId: order.id,
          universityId: order.universityId,
          requestedById: request.user!.id,
          reason: parsed.data.reason,
        },
        select: REQUEST_SELECT,
      });
      await request.audit({
        action: "refund.requested",
        category: "refund",
        entityType: "order",
        entityId: order.id,
        universityId: order.universityId,
        after: { status: "pending" },
        metadata: { requestId: created.id, reason: parsed.data.reason },
      });
      return reply.code(201).send({ request: created });
    } catch (err) {
      // The partial unique index: one pending request per order.
      if ((err as { code?: string }).code === "P2002") {
        return reply.code(409).send({ error: "A refund request for this order is already waiting at HQ" });
      }
      throw err;
    }
  });

  /**
   * HQ approvers see every campus; a campus admin sees their own campus's
   * requests, to follow what happened to them.
   */
  fastify.get("/", { preHandler: fastify.requirePermission("ops.read") }, async (request, reply) => {
    const canDecide = hasPermission(request.user!.staffRole, "refunds.approve");
    const campus = campusOf(request);
    if (!canDecide && !hasPermission(request.user!.staffRole, "refunds.request")) {
      return reply.code(403).send({ error: "Your staff role can't see refund requests" });
    }
    const { status, orderId } = request.query as { status?: string; orderId?: string };
    const where = {
      ...(campus ? { universityId: campus } : {}),
      ...(status && status !== "all" ? { status: status as RefundRequestStatus } : {}),
      ...(orderId ? { orderId } : {}),
    };
    const [requests, counts] = await Promise.all([
      fastify.prisma.refundRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, select: REQUEST_SELECT }),
      fastify.prisma.refundRequest.groupBy({
        by: ["status"],
        where: campus ? { universityId: campus } : {},
        _count: { _all: true },
      }),
    ]);
    // Names for the "asked by" and "decided by" columns, in one lookup.
    const ids = [...new Set(requests.flatMap((r) => [r.requestedById, r.decidedById]).filter(Boolean) as string[])];
    const people = await fastify.prisma.profile.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
    const name = new Map(people.map((p) => [p.id, p.fullName]));
    return reply.send({
      requests: requests.map((r) => ({
        ...r,
        requestedByName: name.get(r.requestedById) ?? null,
        decidedByName: r.decidedById ? (name.get(r.decidedById) ?? null) : null,
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      canDecide,
    });
  });

  fastify.post("/:id/decide", { preHandler: fastify.requirePermission("refunds.approve") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = decideRefundSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const current = await fastify.prisma.refundRequest.findUnique({
      where: { id },
      select: { id: true, status: true, orderId: true, universityId: true, reason: true },
    });
    if (!current) return reply.code(404).send({ error: "Refund request not found" });
    // `failed` can be retried: Paystack refusing once is not a decision.
    if (current.status !== "pending" && current.status !== "failed") {
      return reply.code(409).send({ error: `This request was already ${current.status}` });
    }

    const decided = { decidedById: request.user!.id, decidedAt: new Date(), decisionNote: parsed.data.note || null };

    if (parsed.data.decision === "reject") {
      const updated = await fastify.prisma.refundRequest.update({
        where: { id },
        data: { status: "rejected", ...decided },
        select: REQUEST_SELECT,
      });
      await request.audit({
        action: "refund.request_rejected",
        category: "refund",
        entityType: "order",
        entityId: current.orderId,
        universityId: current.universityId,
        before: { status: current.status },
        after: { status: "rejected", note: decided.decisionNote },
        metadata: { requestId: id },
      });
      return reply.send({ request: updated });
    }

    const result = await endOrderWithRefund({
      fastify,
      log: request.log,
      orderId: current.orderId,
      reason: current.reason,
      actorId: request.user!.id,
      intent: "refund",
      failureReason: "admin_refunded",
      request,
    });
    const updated = await fastify.prisma.refundRequest.update({
      where: { id },
      data: result.ok
        ? { status: "approved", failureDetail: null, ...decided }
        : { status: "failed", failureDetail: result.error, ...decided },
      select: REQUEST_SELECT,
    });
    // endOrderWithRefund has already logged refund.issued / refund.failed.
    // This event ties that to the request and to who approved it.
    await request.audit({
      action: result.ok ? "refund.request_approved" : "refund.request_failed",
      category: "refund",
      entityType: "order",
      entityId: current.orderId,
      universityId: current.universityId,
      outcome: result.ok ? "success" : "failed",
      before: { status: current.status },
      after: { status: updated.status },
      metadata: { requestId: id, ...(result.ok ? { refundIssued: result.refundIssued } : { error: result.error }) },
    });
    if (!result.ok) return reply.code(result.code).send({ error: result.error, request: updated });
    return reply.send({ request: updated });
  });
}
