import { EventEmitter } from "node:events";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import type { AuditActorTypeKey, AuditCategory, AuditOutcomeKey } from "@wave/shared";
import { captureAuditError } from "./sentry";

/**
 * The one way anything is written to `audit_event`.
 *
 * Two properties matter more than the rest:
 *
 *  - **Redaction happens here, not at the call site.** Every `before`, `after`
 *    and `metadata` passes through `redactForAudit` on the way in, so a route
 *    that hands over a whole order row cannot leak a PIN hash or a Paystack
 *    authorisation code by forgetting to strip it.
 *  - **An audit failure never fails the request.** The row is written after
 *    the action it records; if the insert throws, the action has already
 *    happened, and turning a completed refund into a 500 would only make the
 *    client retry it. The failure goes to Sentry, loudly, instead.
 */

export interface AuditInput {
  action: string;
  category: AuditCategory;
  entityType?: string | null;
  entityId?: string | null;
  universityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  outcome?: AuditOutcomeKey;
  /** Overrides the actor derived from the request, e.g. for system jobs. */
  actor?: AuditActor;
}

export interface AuditActor {
  id: string | null;
  type: AuditActorTypeKey;
  role?: string | null;
  staffRole?: string | null;
  name?: string | null;
}

export const SYSTEM_ACTOR: AuditActor = { id: null, type: "system", name: "Wave (automatic)" };

/**
 * Keys whose values never belong in a log, matched case-insensitively against
 * the key's name. Broad on purpose: a false positive costs a readable field, a
 * false negative costs a leaked secret in an append-only table that cannot be
 * cleaned up afterwards.
 */
const SECRET_KEY = /(password|passcode|secret|token|otp|authori[sz]ation|cvv|card_?number|signature|api_?key|cipher|hash|base64|image_?data)/i;

/**
 * "pin" as a word, not a substring — `deliveryPin`, `pin_hash`, `pin` — so that
 * `shipping` or `spinner` survive. Case-sensitive on the camelCase boundary.
 */
const PIN_KEY = /(^pin|Pin|_pin|PIN)/;

/** Keys holding phone numbers — kept, but masked to the last two digits. */
const PHONE_KEY = /phone|msisdn|mobile/i;

/** `+233241234589` → `+233•••••••89`; `0241234589` → `024•••••89`. */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return "•••";
  const plus = value.trim().startsWith("+") ? "+" : "";
  return `${plus}${digits.slice(0, 3)}${"•".repeat(digits.length - 5)}${digits.slice(-2)}`;
}

const MAX_DEPTH = 6;
const MAX_STRING = 500;
const MAX_ARRAY = 50;

export function redactForAudit(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (depth > MAX_DEPTH) return "[truncated]";
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[${value.length} chars]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  // Prisma Decimal, and anything else that knows how to print itself as money.
  if (typeof value === "object" && "toFixed" in value && typeof (value as { toString: unknown }).toString === "function") {
    return (value as { toString(): string }).toString();
  }
  if (Buffer.isBuffer(value)) return `[binary ${value.length} bytes]`;
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((v) => redactForAudit(v, depth + 1));
    if (value.length > MAX_ARRAY) items.push(`…[${value.length - MAX_ARRAY} more]`);
    return items;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key) || PIN_KEY.test(key)) {
        out[key] = v === null || v === undefined ? v ?? null : "[redacted]";
      } else if (PHONE_KEY.test(key) && typeof v === "string") {
        out[key] = maskPhone(v);
      } else {
        out[key] = redactForAudit(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  const redacted = redactForAudit(value);
  return redacted === null ? undefined : (redacted as Prisma.InputJsonValue);
}

/** Who a request is, as the audit log should remember them. */
export function actorFromRequest(request: FastifyRequest | undefined): AuditActor {
  if (!request) return SYSTEM_ACTOR;
  const user = request.user;
  if (!user) return { id: null, type: "anonymous" };
  return {
    id: user.id,
    type: user.role === "admin" ? "staff" : "user",
    role: user.role,
    staffRole: user.staffRole ?? null,
    name: user.fullName ?? null,
  };
}

/** The client's address, honouring the proxy Render puts in front of the API. */
export function clientIp(request: FastifyRequest): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || request.ip || null;
}

/**
 * Carries each committed row to the live panel's open streams.
 *
 * In-process on purpose: the API runs as a single instance. If it ever scales
 * out, a row written on one instance would not reach a stream held by another,
 * and this becomes Postgres LISTEN/NOTIFY. Kept behind this one emitter so that
 * change is local.
 */
export const auditBus = new EventEmitter();
auditBus.setMaxListeners(100);

export async function recordAudit(
  fastify: FastifyInstance,
  input: AuditInput,
  request?: FastifyRequest,
  http?: { statusCode?: number },
): Promise<void> {
  const actor = input.actor ?? actorFromRequest(request);
  try {
    const row = await fastify.prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        actorType: actor.type,
        actorRole: actor.role ?? null,
        actorStaffRole: actor.staffRole ?? null,
        actorName: actor.name ?? null,
        action: input.action,
        category: input.category,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        universityId: input.universityId ?? request?.user?.universityId ?? null,
        before: asJson(input.before),
        after: asJson(input.after),
        metadata: asJson(input.metadata),
        outcome: input.outcome ?? "success",
        ip: request ? clientIp(request) : null,
        userAgent: request ? (request.headers["user-agent"] ?? "").slice(0, 300) || null : null,
        requestId: request ? String(request.id) : null,
        method: request?.method ?? null,
        path: request ? request.url.split("?")[0]!.slice(0, 300) : null,
        statusCode: http?.statusCode ?? null,
      },
    });
    if (request) request.auditRecorded = true;
    auditBus.emit("event", row);
  } catch (err) {
    // Nothing in here may throw: the action this row describes has already
    // happened, and failing its request now would only invite a retry.
    try {
      (request?.log ?? fastify.log).error({ err, action: input.action }, "Audit event could not be written");
      captureAuditError(err, input.action);
    } catch {
      // Reporting failed too. There is nowhere left to report that.
    }
  }
}

declare module "fastify" {
  interface FastifyRequest {
    /** Set once a handler has written its own, richer event for this request. */
    auditRecorded?: boolean;
    /** `recordAudit` bound to this request. */
    audit: (input: AuditInput) => Promise<void>;
  }
}
