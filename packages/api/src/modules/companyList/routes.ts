import type { FastifyInstance } from "fastify";
import { runSheetQuerySchema } from "@wave/shared";
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
 * Because the link has no login it carries the least data that still lets a
 * run happen: shop, checkpoint, items, the student's first name and the order
 * number they will show. No phone numbers.
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
  checkpoint: { select: { name: true } },
  university: { select: { name: true } },
  student: { select: { fullName: true } },
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
          where: { scheduledDate, status: "confirmed", companyId: null, riderId: null },
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
                note: `Handed to ${company.name} (list opened)`,
              })),
            });
            await pushToProfiles({
              fastify,
              log: request.log,
              profileIds: [...new Set(taken.map((o) => o.studentId))],
              payload: {
                title: "With the delivery company",
                body: `${company.name} has your order.`,
              },
            });
          }
        }
      }

      const orders = await fastify.prisma.order.findMany({
        where: { scheduledDate, companyId: company.id, status: { in: [...LIST_STATUSES] } },
        select: LIST_SELECT,
        orderBy: [{ checkpointId: "asc" }, { createdAt: "asc" }],
      });
      const rows = orders.map((o) => ({
        ref: o.id.slice(0, 8).toUpperCase(),
        cancelled: o.status === "cancelled" || o.status === "refunded",
        delivered: o.status === "delivered",
        from:
          o.shop?.name ?? o.suggestion?.name ?? o.originCheckpoint?.name ?? "",
        fromDetail: o.shop?.locationText ?? o.suggestion?.locationText ?? null,
        to: o.checkpoint?.name ?? "",
        campus: o.university?.name ?? "",
        items: o.itemDescription,
        student: (o.student?.fullName ?? "").trim().split(/\s+/)[0] ?? "",
        kind: o.orderType,
      }));

      if (format === "csv") {
        const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const lines = [
          ["Order", "From", "To", "Campus", "Items", "Student", "Status"].map(esc).join(","),
          ...rows.map((r) =>
            [r.ref, r.from, r.to, r.campus, r.items, r.student, r.cancelled ? "CANCELLED - do not deliver" : r.delivered ? "Delivered" : "To deliver"]
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
        receivingOrders: delivery.mode === "company" && delivery.company?.id === company.id,
        counts: {
          toDeliver: rows.filter((r) => !r.cancelled && !r.delivered).length,
          delivered: rows.filter((r) => r.delivered).length,
          cancelled: rows.filter((r) => r.cancelled).length,
        },
        orders: rows,
      });
    },
  );
}
