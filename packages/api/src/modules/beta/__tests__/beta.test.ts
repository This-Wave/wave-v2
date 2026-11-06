import { describe, expect, test, vi } from "vitest";
import type { Role } from "../../../plugins/auth";
import type { AuditInput } from "../../../lib/audit";

vi.mock("../../notifications/dispatch", () => ({ pushToProfiles: vi.fn().mockResolvedValue({ sent: 1 }) }));

import { adminBetaRoutes, betaRoutes } from "../routes";
import { featureRoutes } from "../../features/routes";
import { pushToProfiles } from "../../notifications/dispatch";
import { buildTestApp } from "../../../test/harness";

const STUDENT = { id: "stu-1", role: "student" as Role };
const staff = (staffRole: string) => ({ id: "s1", role: "admin" as Role, staffRole });

function makePrisma(existing: { status: string } | null = null) {
  return {
    betaApplication: {
      findUnique: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({ ...create, status: "pending" })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "app-1", ...data })),
    },
    betaFeedback: { create: vi.fn().mockResolvedValue({ id: "fb-1", createdAt: new Date() }) },
  };
}

describe("applying", () => {
  test("a student applies once, and it is audited", async () => {
    const prisma = makePrisma();
    const audits: AuditInput[] = [];
    const app = await buildTestApp(betaRoutes, { prisma, user: STUDENT, audits });
    const res = await app.inject({ method: "POST", url: "/apply", payload: { reason: "I order every Wave" } });
    expect(res.statusCode).toBe(201);
    expect(audits[0]).toMatchObject({ action: "beta.applied", after: { status: "pending" } });
  });

  test("applying while pending is refused rather than duplicated", async () => {
    const app = await buildTestApp(betaRoutes, { prisma: makePrisma({ status: "pending" }), user: STUDENT });
    expect((await app.inject({ method: "POST", url: "/apply", payload: {} })).statusCode).toBe(409);
  });

  test("a rejected student may try again; a revoked one may not", async () => {
    const again = await buildTestApp(betaRoutes, { prisma: makePrisma({ status: "rejected" }), user: STUDENT });
    expect((await again.inject({ method: "POST", url: "/apply", payload: {} })).statusCode).toBe(200);
    const revoked = await buildTestApp(betaRoutes, { prisma: makePrisma({ status: "revoked" }), user: STUDENT });
    expect((await revoked.inject({ method: "POST", url: "/apply", payload: {} })).statusCode).toBe(403);
  });

  test("shop owners can't join", async () => {
    const app = await buildTestApp(betaRoutes, { prisma: makePrisma(), user: { id: "o", role: "shop_owner" } });
    expect((await app.inject({ method: "POST", url: "/apply", payload: {} })).statusCode).toBe(403);
  });

  test("only approved testers can send feedback", async () => {
    const pending = await buildTestApp(betaRoutes, { prisma: makePrisma({ status: "pending" }), user: STUDENT });
    expect((await pending.inject({ method: "POST", url: "/feedback", payload: { message: "Checkout froze" } })).statusCode).toBe(403);
    const approved = await buildTestApp(betaRoutes, { prisma: makePrisma({ status: "approved" }), user: STUDENT });
    expect((await approved.inject({ method: "POST", url: "/feedback", payload: { message: "Checkout froze", screen: "OrderSummary" } })).statusCode).toBe(201);
  });
});

describe("reviewing", () => {
  const pendingApp = { status: "pending", profileId: "stu-1", profile: { fullName: "Ama" } };

  test("support approves; the tester is told by push", async () => {
    const prisma = makePrisma(pendingApp as never);
    const audits: AuditInput[] = [];
    const app = await buildTestApp(adminBetaRoutes, { prisma, user: staff("support"), audits });
    const res = await app.inject({ method: "POST", url: "/beta/app-1/review", payload: { decision: "approve" } });
    expect(res.statusCode).toBe(200);
    expect(audits[0]).toMatchObject({ action: "beta.approved", before: { status: "pending" } });
    expect(pushToProfiles).toHaveBeenCalled();
  });

  test("an accountant can't review", async () => {
    const app = await buildTestApp(adminBetaRoutes, { prisma: makePrisma(pendingApp as never), user: staff("accountant") });
    expect((await app.inject({ method: "POST", url: "/beta/app-1/review", payload: { decision: "approve" } })).statusCode).toBe(403);
  });

  test("revoking only applies to an approved tester", async () => {
    const app = await buildTestApp(adminBetaRoutes, { prisma: makePrisma(pendingApp as never), user: staff("owner") });
    expect((await app.inject({ method: "POST", url: "/beta/app-1/review", payload: { decision: "revoke" } })).statusCode).toBe(409);
  });
});

describe("GET /features for a beta tester", () => {
  function flagsPrisma(status: string | null) {
    return {
      profile: { findUnique: vi.fn().mockResolvedValue({ universityId: "uni-1" }) },
      featureFlag: { findMany: vi.fn().mockResolvedValue([{ key: "group_orders", universityId: null, state: "beta" }]) },
      betaApplication: { findUnique: vi.fn().mockResolvedValue(status ? { status } : null) },
    };
  }

  test("a beta flag is on for an approved tester", async () => {
    const app = await buildTestApp(featureRoutes, { prisma: flagsPrisma("approved"), user: STUDENT });
    expect((await app.inject({ method: "GET", url: "/features" })).json().features.group_orders).toBe(true);
  });

  test("and off for anyone else, including a pending applicant", async () => {
    const app = await buildTestApp(featureRoutes, { prisma: flagsPrisma("pending"), user: STUDENT });
    expect((await app.inject({ method: "GET", url: "/features" })).json().features.group_orders).toBe(false);
  });
});
