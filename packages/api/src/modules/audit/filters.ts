import type { Prisma } from "@prisma/client";
import { AUDIT_ACTOR_TYPES, AUDIT_OUTCOMES, isAuditCategory } from "@wave/shared";

/**
 * One set of filters, applied two ways: as a Prisma `where` for the page and
 * the export, and as an in-memory predicate for rows arriving on the live
 * stream. Keeping both here is what stops the stream showing a row the table
 * would have hidden.
 */
export interface AuditFilters {
  from?: Date;
  to?: Date;
  categories?: string[];
  outcome?: string;
  actorType?: string;
  actorRole?: string;
  staffRole?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  universityId?: string;
  /** Free text: matched against actor name, action, entity id and IP. */
  q?: string;
}

function str(v: unknown, max = 120): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function date(v: unknown): Date | undefined {
  const s = str(v, 40);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

/** Query string → filters. Unknown or malformed values are dropped, not errors. */
export function parseAuditFilters(query: Record<string, unknown>): AuditFilters {
  const categories = (str(query.category, 400) ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(isAuditCategory);
  const outcome = str(query.outcome);
  const actorType = str(query.actorType);
  return {
    from: date(query.from),
    to: date(query.to),
    categories: categories.length ? categories : undefined,
    outcome: outcome && (AUDIT_OUTCOMES as readonly string[]).includes(outcome) ? outcome : undefined,
    actorType: actorType && (AUDIT_ACTOR_TYPES as readonly string[]).includes(actorType) ? actorType : undefined,
    actorRole: str(query.actorRole),
    staffRole: str(query.staffRole),
    actorId: str(query.actorId),
    entityType: str(query.entityType),
    entityId: str(query.entityId),
    universityId: str(query.universityId),
    q: str(query.q),
  };
}

export function auditWhere(f: AuditFilters): Prisma.AuditEventWhereInput {
  const and: Prisma.AuditEventWhereInput[] = [];
  if (f.from || f.to) and.push({ occurredAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } });
  if (f.categories) and.push({ category: { in: f.categories } });
  if (f.outcome) and.push({ outcome: f.outcome as never });
  if (f.actorType) and.push({ actorType: f.actorType as never });
  if (f.actorRole) and.push({ actorRole: f.actorRole });
  if (f.staffRole) and.push({ actorStaffRole: f.staffRole });
  if (f.actorId) and.push({ actorId: f.actorId });
  if (f.entityType) and.push({ entityType: f.entityType });
  if (f.entityId) and.push({ entityId: f.entityId });
  if (f.universityId) and.push({ universityId: f.universityId });
  if (f.q) {
    and.push({
      OR: [
        { actorName: { contains: f.q, mode: "insensitive" } },
        { action: { contains: f.q, mode: "insensitive" } },
        { entityId: { contains: f.q } },
        { actorId: { contains: f.q } },
        { ip: { contains: f.q } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

type Row = {
  occurredAt: Date;
  category: string;
  outcome: string;
  actorType: string;
  actorRole: string | null;
  actorStaffRole: string | null;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  universityId: string | null;
  ip: string | null;
};

export function auditMatches(row: Row, f: AuditFilters): boolean {
  const at = new Date(row.occurredAt).getTime();
  if (f.from && at < f.from.getTime()) return false;
  if (f.to && at > f.to.getTime()) return false;
  if (f.categories && !f.categories.includes(row.category)) return false;
  if (f.outcome && row.outcome !== f.outcome) return false;
  if (f.actorType && row.actorType !== f.actorType) return false;
  if (f.actorRole && row.actorRole !== f.actorRole) return false;
  if (f.staffRole && row.actorStaffRole !== f.staffRole) return false;
  if (f.actorId && row.actorId !== f.actorId) return false;
  if (f.entityType && row.entityType !== f.entityType) return false;
  if (f.entityId && row.entityId !== f.entityId) return false;
  if (f.universityId && row.universityId !== f.universityId) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const hay = [row.actorName, row.action, row.entityId, row.actorId, row.ip].filter(Boolean).map((s) => s!.toLowerCase());
    if (!hay.some((h) => h.includes(q))) return false;
  }
  return true;
}
