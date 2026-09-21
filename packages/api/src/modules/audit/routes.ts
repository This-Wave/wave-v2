import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuditEvent } from "@prisma/client";
import { hasPermission } from "@wave/shared";
import { auditBus } from "../../lib/audit";
import { auditMatches, auditWhere, parseAuditFilters, type AuditFilters } from "./filters";

const PAGE_SIZE = 50;
const EXPORT_CAP = 10_000;
const HEARTBEAT_MS = 25_000;

/**
 * The audit log, for staff.
 *
 * Owner and Auditor (`audit.read_all`) see everything. Every other staff role
 * sees only rows where they are the actor — enough to answer "what did I do?"
 * without letting Support read who Claims refunded. The scoping is applied to
 * the filters themselves, so it holds for the page, the stream and the export
 * alike, and cannot be undone by a query parameter.
 */
export async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermission("ops.read"));

  // Open live streams, so a shutdown can end them. Without this, `app.close()`
  // waits on connections that never finish and a deploy hangs on drain.
  const streams = new Set<() => void>();
  fastify.addHook("onClose", async () => {
    for (const end of streams) end();
  });

  function scopedFilters(request: FastifyRequest): { filters: AuditFilters; scope: "all" | "own" } {
    const filters = parseAuditFilters(request.query as Record<string, unknown>);
    if (hasPermission(request.user!.staffRole, "audit.read_all")) return { filters, scope: "all" };
    return { filters: { ...filters, actorId: request.user!.id }, scope: "own" };
  }

  /** A page, newest first. `before` is the cursor: the id of the last row seen. */
  fastify.get("/audit", async (request, reply) => {
    const { filters, scope } = scopedFilters(request);
    const { before } = request.query as { before?: string };
    const cursorRow = before
      ? await fastify.prisma.auditEvent.findUnique({ where: { id: before }, select: { occurredAt: true, id: true } })
      : null;

    const where = auditWhere(filters);
    const events = await fastify.prisma.auditEvent.findMany({
      where: cursorRow
        ? {
            AND: [
              where,
              {
                OR: [
                  { occurredAt: { lt: cursorRow.occurredAt } },
                  { occurredAt: cursorRow.occurredAt, id: { lt: cursorRow.id } },
                ],
              },
            ],
          }
        : where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
    });

    const hasMore = events.length > PAGE_SIZE;
    return reply.send({ events: events.slice(0, PAGE_SIZE), hasMore, scope });
  });

  /** What the filter dropdowns can offer: the actions and entity types that actually occur. */
  fastify.get("/audit/facets", async (request, reply) => {
    const { filters } = scopedFilters(request);
    const scoped = filters.actorId ? { actorId: filters.actorId } : {};
    const [actions, entityTypes] = await Promise.all([
      fastify.prisma.auditEvent.groupBy({ by: ["action"], where: scoped, _count: { _all: true }, orderBy: { action: "asc" }, take: 300 }),
      fastify.prisma.auditEvent.groupBy({ by: ["entityType"], where: scoped, orderBy: { entityType: "asc" }, take: 50 }),
    ]);
    return reply.send({
      actions: actions.map((a) => ({ action: a.action, count: a._count._all })),
      entityTypes: entityTypes.map((e) => e.entityType).filter(Boolean),
    });
  });

  /**
   * New rows as they are written, as server-sent events.
   *
   * Read with `fetch()` rather than `EventSource`, because EventSource cannot
   * send an Authorization header and a token in the URL ends up in every proxy
   * log. The client reconnects with backoff; a heartbeat comment every 25s
   * keeps Render's proxy from closing an idle connection.
   */
  fastify.get("/audit/stream", async (request, reply) => {
    const { filters } = scopedFilters(request);

    reply.hijack();
    reply.raw.writeHead(200, {
      // CORS and the other plugin headers were set on `reply` in onRequest;
      // writing the raw head directly would otherwise drop them.
      ...(reply.getHeaders() as Record<string, string>),
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    reply.raw.write(": connected\n\n");

    const onEvent = (row: AuditEvent) => {
      if (!auditMatches(row, filters)) return;
      reply.raw.write(`event: audit\ndata: ${JSON.stringify(row)}\n\n`);
    };
    const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), HEARTBEAT_MS);
    heartbeat.unref();

    auditBus.on("event", onEvent);
    const end = () => {
      clearInterval(heartbeat);
      auditBus.off("event", onEvent);
      streams.delete(end);
      if (!reply.raw.writableEnded) reply.raw.end();
    };
    streams.add(end);
    request.raw.on("close", end);
  });

  /** The current filter as CSV. The export is itself audited: it is data leaving Wave. */
  fastify.get("/audit/export.csv", async (request, reply) => {
    const { filters, scope } = scopedFilters(request);
    const events = await fastify.prisma.auditEvent.findMany({
      where: auditWhere(filters),
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: EXPORT_CAP,
    });

    await request.audit({
      action: "audit.exported",
      category: "pii",
      metadata: { rows: events.length, scope, filters: { ...filters, from: filters.from?.toISOString(), to: filters.to?.toISOString() } },
    });

    const header = [
      "occurred_at", "outcome", "category", "action", "actor_type", "actor_name", "actor_role", "actor_staff_role",
      "actor_id", "entity_type", "entity_id", "university_id", "ip", "user_agent", "method", "path", "status_code",
      "request_id", "before", "after", "metadata",
    ];
    const lines = events.map((e) =>
      [
        e.occurredAt.toISOString(), e.outcome, e.category, e.action, e.actorType, e.actorName, e.actorRole,
        e.actorStaffRole, e.actorId, e.entityType, e.entityId, e.universityId, e.ip, e.userAgent, e.method, e.path,
        e.statusCode, e.requestId, json(e.before), json(e.after), json(e.metadata),
      ]
        .map(csvCell)
        .join(","),
    );
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="wave-audit-${stamp}.csv"`)
      .send([header.join(","), ...lines].join("\n"));
  });
}

function json(value: unknown): string {
  return value === null || value === undefined ? "" : JSON.stringify(value);
}

/**
 * RFC 4180 quoting, plus a leading apostrophe on anything a spreadsheet would
 * run as a formula. The log records what users typed, and a shop name of
 * `=HYPERLINK(...)` must not execute on an accountant's laptop.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
