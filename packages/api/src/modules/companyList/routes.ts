import type { FastifyInstance } from "fastify";
import { orderRef, DEFAULT_HUB_ADDRESS, HUB_ADDRESS_KEY, HUB_STAGE_COPY, runSheetQuerySchema } from "@wave/shared";
import { activeDelivery } from "../companies/mode";
import { pushToProfiles } from "../notifications/dispatch";
import { COMPANY_LIST_RATE_LIMIT } from "../../plugins/rateLimit";
import { hashListToken } from "./token";

/**
 * The delivery company's list: one private link, no login (owner decision
 * 2026-11-04 — "we don't know how they operate", so Wave asks nothing of them
 * but to open a link). It shows the day's orders, prints, and downloads as a
 * spreadsheet.
 *
 * Opening it is the handover. Every paid order nobody holds yet, for the day
 * being viewed, is stamped as this company's (`companyId`, status
 * `rider_assigned`, no rider) and the student is told it is with the company.
 * Cancelled orders stay on the list, marked, so a printed copy can be checked
 * against it.
 *
 * The company only collects: everything goes to Wave's packing point, where
 * Wave packs it into Wave bags and delivers it (owner, 2026-11-04). So the
 * list carries what a collection needs and nothing about the student at all:
 * where to collect, what, and the order number to write on it. No names, no
 * phone numbers, no checkpoints. Students are never told a company exists.
 */

const LIST_STATUSES = ["rider_assigned", "en_route", "at_checkpoint", "delivered", "cancelled", "refunded"] as const;

const LIST_SELECT = {
  id: true,
  status: true,
  orderType: true,
  itemDescription: true,
  scheduledDate: true,
  shop: { select: { name: true, locationText: true } },
  suggestion: { select: { name: true, locationText: true } },
  originCheckpoint: { select: { name: true } },
  university: { select: { name: true } },
} as const;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function companyListRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:token",
    { config: { rateLimit: COMPANY_LIST_RATE_LIMIT } },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const parsed = runSheetQuerySchema.safeParse(request.query);
      if (!parsed.success || token.length < 20 || token.length > 100) {
        return reply.code(404).send({ error: "This link doesn't work. Ask Wave for a new one." });
      }
      const format = (request.query as { format?: string }).format;

      const company = await fastify.prisma.deliveryCompany.findUnique({
        where: { listTokenHash: hashListToken(token) },
        select: { id: true, name: true, isActive: true },
      });
      // One answer for "never existed", "turned off" and "company deactivated":
      // the link is a secret, so which of those it is is nobody's business.
      if (!company?.isActive) {
        return reply.code(404).send({ error: "This link doesn't work. Ask Wave for a new one." });
      }

      const date = parsed.data.date ?? todayUtc();
      const scheduledDate = new Date(date);

      // The handover: only while Wave has this company running deliveries.
      const delivery = await activeDelivery(fastify);
      if (delivery.mode === "company" && delivery.company?.id === company.id) {
        const fresh = await fastify.prisma.order.findMany({
          where: { scheduledDate, status: "confirmed", companyId: null, riderId: null, isTest: false },
          select: { id: true, studentId: true },
        });
        if (fresh.length) {
          const ids = fresh.map((o) => o.id);
          // The status predicate is the lock: an order cancelled or claimed in
          // the meantime is not swept up.
          await fastify.prisma.order.updateMany({
            where: { id: { in: ids }, status: "confirmed", companyId: null, riderId: null },
            data: { companyId: company.id, status: "rider_assigned", assignedAt: new Date() },
          });
          const taken = await fastify.prisma.order.findMany({
            where: { id: { in: ids }, companyId: company.id },
            select: { id: true, studentId: true },
          });
          if (taken.length) {
            await fastify.prisma.orderStatusHistory.createMany({
              data: taken.map((o) => ({
                orderId: o.id,
                status: "rider_assigned" as const,
                changedBy: null,
                note: "Collecting (company list opened)",
              })),
            });
            await pushToProfiles({
              fastify,
              log: request.log,
              profileIds: [...new Set(taken.map((o) => o.studentId))],
              payload: { ...HUB_STAGE_COPY.rider_assigned },
            });
          }
        }
      }

      const orders = await fastify.prisma.order.findMany({
        where: { scheduledDate, companyId: company.id, isTest: false, status: { in: [...LIST_STATUSES] } },
        select: LIST_SELECT,
        orderBy: [{ shopId: "asc" }, { originCheckpointId: "asc" }, { createdAt: "asc" }],
      });
      const hub = await fastify.prisma.platformConfig.findUnique({ where: { key: HUB_ADDRESS_KEY } });
      const bringTo = hub?.value?.trim() || DEFAULT_HUB_ADDRESS;
      const rows = orders.map((o) => ({
        ref: orderRef(o.id),
        cancelled: o.status === "cancelled" || o.status === "refunded",
        // The company's part ends when Wave receives it at the packing point.
        delivered: o.status === "en_route" || o.status === "at_checkpoint" || o.status === "delivered",
        from:
          o.shop?.name ?? o.suggestion?.name ?? o.originCheckpoint?.name ?? "",
        fromDetail: o.shop?.locationText ?? o.suggestion?.locationText ?? null,
        campus: o.university?.name ?? "",
        items: o.itemDescription,
        kind: o.orderType,
      }));

      if (format === "csv") {
        const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const lines = [
          ["Order", "Collect from", "Where", "Items", "Bring to", "Status"].map(esc).join(","),
          ...rows.map((r) =>
            [r.ref, r.from, r.fromDetail ?? "", r.items, bringTo, r.cancelled ? "CANCELLED - do not collect" : r.delivered ? "Brought in" : "To collect"]
              .map(esc)
              .join(","),
          ),
        ];
        return reply
          .header("content-type", "text/csv; charset=utf-8")
          .header("content-disposition", `attachment; filename="wave-${date}.csv"`)
          .header("cache-control", "no-store")
          .send(lines.join("\n"));
      }

      return reply.header("cache-control", "no-store").send({
        company: { name: company.name },
        date,
        bringTo,
        receivingOrders: delivery.mode === "company" && delivery.company?.id === company.id,
        counts: {
          toCollect: rows.filter((r) => !r.cancelled && !r.delivered).length,
          done: rows.filter((r) => r.delivered).length,
          cancelled: rows.filter((r) => r.cancelled).length,
        },
        orders: rows,
      });
    },
  );
}
