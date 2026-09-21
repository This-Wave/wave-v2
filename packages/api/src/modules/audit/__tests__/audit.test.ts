import { describe, expect, test, vi } from "vitest";
import type { Role } from "../../../plugins/auth";
import type { AuditInput } from "../../../lib/audit";
import { auditRoutes, csvCell } from "../routes";
import { auditMatches, auditWhere, parseAuditFilters } from "../filters";
import { buildTestApp } from "../../../test/harness";

const staff = (staffRole: string, id = "me") => ({ id, role: "admin" as Role, staffRole });

function makePrisma() {
  return {
    auditEvent: {
      findMany: vi.fn().mockResolvedValue([{ id: "e1", action: "order.accepted", occurredAt: new Date(), actorName: "=cmd" }]),
      findUnique: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  };
}

describe("who sees what", () => {
  test("the auditor sees everyone's actions", async () => {
    const prisma = makePrisma();
    const app = await buildTestApp(auditRoutes, { prisma, user: staff("auditor") });
    const res = await app.inject({ method: "GET", url: "/audit?actorId=someone-else" });
    expect(res.json().scope).toBe("all");
    expect(JSON.stringify(prisma.auditEvent.findMany.mock.calls[0]?.[0].where)).toContain("someone-else");
  });

  test("support sees only their own, and can't ask for anyone else's", async () => {
    const prisma = makePrisma();
    const app = await buildTestApp(auditRoutes, { prisma, user: staff("support", "sup-1") });
    const res = await app.inject({ method: "GET", url: "/audit?actorId=owner-1" });
    expect(res.json().scope).toBe("own");
    const where = JSON.stringify(prisma.auditEvent.findMany.mock.calls[0]?.[0].where);
    expect(where).toContain("sup-1");
    expect(where).not.toContain("owner-1");
  });

  test("customers can't read the log at all", async () => {
    const app = await buildTestApp(auditRoutes, { prisma: makePrisma(), user: { id: "s", role: "student" } });
    expect((await app.inject({ method: "GET", url: "/audit" })).statusCode).toBe(403);
  });

  test("an export is itself logged", async () => {
    const audits: AuditInput[] = [];
    const app = await buildTestApp(auditRoutes, { prisma: makePrisma(), user: staff("owner"), audits });
    const res = await app.inject({ method: "GET", url: "/audit/export.csv?category=refund" });
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(audits[0]).toMatchObject({ action: "audit.exported", category: "pii" });
  });
});

describe("csvCell", () => {
  test("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("-1+2")).toBe("'-1+2");
  });
  test("quotes commas and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell(null)).toBe("");
  });
});

describe("filters", () => {
  const row = {
    occurredAt: new Date("2026-09-21T10:00:00Z"),
    category: "refund",
    outcome: "success",
    actorType: "staff",
    actorRole: "admin",
    actorStaffRole: "claims_officer",
    actorId: "c1",
    actorName: "Esi Mensah",
    action: "refund.issued",
    entityType: "order",
    entityId: "ord-9",
    universityId: "u1",
    ip: "41.66.1.1",
  };

  test("the stream predicate agrees with the parsed filters", () => {
    expect(auditMatches(row, parseAuditFilters({ category: "refund,payment", q: "esi" }))).toBe(true);
    expect(auditMatches(row, parseAuditFilters({ category: "order" }))).toBe(false);
    expect(auditMatches(row, parseAuditFilters({ to: "2026-09-21T09:00:00Z" }))).toBe(false);
    expect(auditMatches(row, parseAuditFilters({ entityId: "ord-9", outcome: "success" }))).toBe(true);
  });

  test("drops values it doesn't recognise instead of failing", () => {
    const f = parseAuditFilters({ category: "nonsense", outcome: "maybe", from: "not a date" });
    expect(f).toMatchObject({ categories: undefined, outcome: undefined, from: undefined });
    expect(auditWhere(f)).toEqual({});
  });
});
