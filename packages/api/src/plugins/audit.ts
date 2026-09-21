import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { recordAudit, type AuditInput } from "../lib/audit";
import { ROUTE_AUDIT, categoryForPath, pick } from "../lib/auditRoutes";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * The audit log's safety net.
 *
 * Handlers that know what they did write their own event through
 * `request.audit(...)`, with before and after values. This hook covers the
 * rest, after the reply has gone out, so it adds nothing to response time:
 *
 *  - every mutating request that reached a handler and wasn't already
 *    described, named from `lib/auditRoutes.ts`;
 *  - every refusal: a 403 anywhere, a 401 or 429 on a route that needed a
 *    session or is rate-limited on purpose. These are the attempts an auditor
 *    most wants to see, and a handler that rejected someone has, by
 *    definition, not written an event of its own.
 *
 * Validation failures (400) and not-founds (404) are skipped on purpose — they
 * record typos, not activity, and on a free-tier database the space matters.
 */
export default fp(async function auditPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("auditRecorded", false);
  fastify.decorateRequest("audit", function (this: FastifyRequest, input: AuditInput) {
    return recordAudit(fastify, input, this);
  });
  fastify.decorateRequest("auditReplyBody", null);

  // Keep the reply body for routes whose entity id only exists after the
  // handler ran — a new order's id, a new shop's id.
  fastify.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    const spec = ROUTE_AUDIT[routeKey(request)];
    if (spec?.entityFromReply && typeof payload === "string" && reply.statusCode < 300) {
      try {
        request.auditReplyBody = JSON.parse(payload) as unknown;
      } catch {
        // Not JSON; the event is written without an entity id.
      }
    }
    return payload;
  });

  fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.auditRecorded) return;
    const status = reply.statusCode;
    const path = routePath(request);
    if (!path || path === "/health") return;

    const denied = status === 403 || status === 429 || (status === 401 && request.headers.authorization !== undefined);
    const loginFailed = status === 401 && path === "/v1/auth/login";
    const webhookRejected = status === 401 && path === "/v1/payments/webhook";
    const mutating = MUTATING.has(request.method);

    if (!mutating && !denied) return;
    if (mutating && !denied && !loginFailed && !webhookRejected && (status === 400 || status === 404)) return;

    const spec = ROUTE_AUDIT[routeKey(request)];
    const params = (request.params ?? {}) as Record<string, string>;
    const body = request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};

    const entityId =
      (spec?.entityParam && params[spec.entityParam]) ||
      (spec?.entityFromReply ? (pick(request.auditReplyBody, spec.entityFromReply) as string | undefined) : undefined) ||
      (typeof body.orderId === "string" ? body.orderId : undefined) ||
      null;

    const metadata: Record<string, unknown> = {};
    for (const key of spec?.body ?? []) {
      if (body[key] !== undefined) metadata[key] = body[key];
    }
    if (path === "/v1/payments/webhook") {
      const data = (body.data ?? {}) as Record<string, unknown>;
      metadata.event = body.event;
      metadata.reference = data.reference;
      metadata.amountPesewas = data.amount;
      metadata.chargeStatus = data.status;
    }
    if (status >= 400) {
      metadata.statusCode = status;
    }

    let action = spec?.action ?? `http.${request.method.toLowerCase()}`;
    let category = spec?.category ?? categoryForPath(path);
    if (loginFailed) action = "auth.login_failed";
    if (webhookRejected) action = "payment.webhook_bad_signature";
    if (denied) {
      category = "security";
      action = status === 429 ? "security.rate_limited" : status === 401 ? "security.session_rejected" : "security.forbidden";
      metadata.attempted = spec?.action ?? `${request.method} ${path}`;
    }

    await recordAudit(
      fastify,
      {
        action,
        category,
        entityType: spec?.entityType ?? null,
        entityId,
        metadata: Object.keys(metadata).length ? metadata : undefined,
        outcome: denied || loginFailed || webhookRejected ? "denied" : status >= 400 ? "failed" : "success",
        actor: path === "/v1/payments/webhook" ? { id: null, type: "webhook", name: "Paystack" } : path === "/v1/auth/sms-hook" ? { id: null, type: "webhook", name: "Supabase Auth" } : undefined,
      },
      request,
      { statusCode: status },
    );
  });
});

/** The route's pattern with the prefix, no trailing slash: `/v1/orders/:id/accept`. */
function routePath(request: FastifyRequest): string | null {
  const url = request.routeOptions?.url;
  if (!url) return null;
  return url.length > 1 ? url.replace(/\/$/, "") : url;
}

function routeKey(request: FastifyRequest): string {
  return `${request.method} ${routePath(request) ?? ""}`;
}

declare module "fastify" {
  interface FastifyRequest {
    auditReplyBody: unknown;
  }
}
