import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";
import type { AuditInput } from "../../../lib/audit";

vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));
vi.mock("../../suggestions/announce", () => ({ announceShopIsLive: vi.fn() }));

import { campusAdminRoutes } from "../routes";
import { refundRequestRoutes } from "../../refundRequests/routes";
import { adminRoutes } from "../../admin/routes";
import { adminSwitchRoutes } from "../../switches/routes";
import { auditRoutes } from "../../audit/routes";
import { endOrderWithRefund } from "../../payments/refund";
import { buildTestApp } from "../../../test/harness";

const ASHESI = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const campusAdmin = { id: "ca-1", role: "admin" as Role, staffRole: "campus_admin", campusId: ASHESI };
const hq = (staffRole: string) => ({ id: `hq-${staffRole}`, role: "admin" as Role, staffRole });

beforeEach(() => vi.clearAllMocks());

describe("the campus wall", () => {
  test("a campus admin's order list is filtered to their campus", async () => {
    const prisma = { order: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) } };
    const app = await buildTestApp(adminRoutes, { prisma, user: campusAdmin });
    await app.inject({ method: "GET", url: "/orders" });
    expect(prisma.order.findMany.mock.calls[0]?.[0].where).toMatchObject({ universityId: ASHESI });
  });

  test("HQ's is not", async () => {
    const prisma = { order: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) } };
    const app = await buildTestApp(adminRoutes, { prisma, user: hq("owner") });
    await app.inject({ method: "GET", url: "/orders" });
    expect(prisma.order.findMany.mock.calls[0]?.[0].where).not.toHaveProperty("universityId");
  });

  test("another campus's order is a 404, not a 403", async () => {
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({ id: ORDER, universityId: OTHER, student: { id: "s" }, rider: null }),
      },
    };
    const app = await buildTestApp(adminRoutes, { prisma, user: campusAdmin });
    expect((await app.inject({ method: "GET", url: `/orders/${ORDER}` })).statusCode).toBe(404);
  });

  test("a campus admin can't force-deliver another campus's order", async () => {
    const prisma = { order: { findUnique: vi.fn().mockResolvedValue({ id: ORDER, universityId: OTHER, riderId: "r" }), updateMany: vi.fn() } };
    const app = await buildTestApp(adminRoutes, { prisma, user: campusAdmin });
    const res = await app.inject({ method: "POST", url: `/orders/${ORDER}/force-deliver`, payload: { reason: "Phone died" } });
    expect(res.statusCode).toBe(404);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  test("a campus admin can't refund directly or change pricing", async () => {
    const app = await buildTestApp(adminRoutes, { prisma: {}, user: campusAdmin });
    expect((await app.inject({ method: "POST", url: `/refund/${ORDER}`, payload: { reason: "x" } })).statusCode).toBe(403);
    expect((await app.inject({ method: "PUT", url: "/config", payload: { key: "delivery_fee_base", value: "1" } })).statusCode).toBe(403);
  });

  test("a campus admin with no campus set is refused everything", async () => {
    const app = await buildTestApp(adminRoutes, { prisma: {}, user: { ...campusAdmin, campusId: null } });
    expect((await app.inject({ method: "GET", url: "/orders" })).statusCode).toBe(403);
  });

  test("a campus admin pauses their campus but not every campus", async () => {
    const prisma = {
      serviceSwitch: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)) },
      university: { findUnique: vi.fn().mockResolvedValue({ id: ASHESI }) },
    };
    const app = await buildTestApp(adminSwitchRoutes, { prisma, user: campusAdmin });
    const global = await app.inject({ method: "PUT", url: "/switches", payload: { key: "buy_for_me", universityId: null, paused: true } });
    expect(global.statusCode).toBe(403);
    const own = await app.inject({ method: "PUT", url: "/switches", payload: { key: "buy_for_me", universityId: ASHESI, paused: true } });
    expect(own.statusCode).toBe(200);
  });

  test("a campus admin reads their campus's whole log, and only theirs", async () => {
    const prisma = { auditEvent: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() } };
    const app = await buildTestApp(auditRoutes, { prisma, user: campusAdmin });
    const res = await app.inject({ method: "GET", url: `/audit?universityId=${OTHER}` });
    expect(res.json().scope).toBe("campus");
    const where = JSON.stringify(prisma.auditEvent.findMany.mock.calls[0]?.[0].where);
    expect(where).toContain(ASHESI);
    expect(where).not.toContain(OTHER);
  });
});

describe("adding campus admins", () => {
  function makePrisma(person: unknown) {
    return {
      university: { findUnique: vi.fn().mockResolvedValue({ id: ASHESI, name: "Ashesi", isActive: true }), findMany: vi.fn().mockResolvedValue([]) },
      profile: {
        findUnique: vi.fn().mockResolvedValue(person),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "p1", ...data })),
      },
    };
  }

  test("support adds one, and that is the approval — logged", async () => {
    const prisma = makePrisma({ id: "p1", role: "student", fullName: "Kojo", isActive: true });
    const audits: AuditInput[] = [];
    const app = await buildTestApp(campusAdminRoutes, { prisma, user: hq("support"), audits });
    const res = await app.inject({ method: "POST", url: "/", payload: { phone: "0201112223", universityId: ASHESI } });
    expect(res.statusCode).toBe(201);
    expect(prisma.profile.update.mock.calls[0]?.[0].data).toEqual({ role: "admin", staffRole: "campus_admin", adminUniversityId: ASHESI });
    expect(audits[0]).toMatchObject({ action: "campus_admin.approved", universityId: ASHESI });
  });

  test("an accountant can't, and neither can a campus admin", async () => {
    for (const user of [hq("accountant"), campusAdmin]) {
      const app = await buildTestApp(campusAdminRoutes, { prisma: makePrisma(null), user });
      expect((await app.inject({ method: "POST", url: "/", payload: { phone: "0201112223", universityId: ASHESI } })).statusCode).toBe(403);
    }
  });
});

describe("refund requests", () => {
  function makePrisma(order: unknown, request: unknown = null) {
    return {
      order: { findUnique: vi.fn().mockResolvedValue(order) },
      refundRequest: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "rr-1", ...data })),
        findUnique: vi.fn().mockResolvedValue(request),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "rr-1", ...data })),
      },
    };
  }
  const paidOrder = { id: ORDER, universityId: ASHESI, status: "confirmed", paidAt: new Date(), goodsPaidAt: null };

  test("a campus admin files a request for their own campus's order", async () => {
    const prisma = makePrisma(paidOrder);
    const app = await buildTestApp(refundRequestRoutes, { prisma, user: campusAdmin });
    const res = await app.inject({ method: "POST", url: "/", payload: { orderId: ORDER, reason: "Shop was closed when the rider arrived" } });
    expect(res.statusCode).toBe(201);
    expect(endOrderWithRefund).not.toHaveBeenCalled();
  });

  test("not for another campus's order", async () => {
    const app = await buildTestApp(refundRequestRoutes, { prisma: makePrisma({ ...paidOrder, universityId: OTHER }), user: campusAdmin });
    const res = await app.inject({ method: "POST", url: "/", payload: { orderId: ORDER, reason: "Shop was closed" } });
    expect(res.statusCode).toBe(404);
  });

  test("a second request while one is pending is refused", async () => {
    const prisma = makePrisma(paidOrder);
    prisma.refundRequest.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const app = await buildTestApp(refundRequestRoutes, { prisma, user: campusAdmin });
    const res = await app.inject({ method: "POST", url: "/", payload: { orderId: ORDER, reason: "Shop was closed" } });
    expect(res.statusCode).toBe(409);
  });

  test("the campus admin can't approve their own request", async () => {
    const app = await buildTestApp(refundRequestRoutes, { prisma: makePrisma(paidOrder), user: campusAdmin });
    expect((await app.inject({ method: "POST", url: "/rr-1/decide", payload: { decision: "approve" } })).statusCode).toBe(403);
  });

  test("the accountant approves and the money moves through the one refund path", async () => {
    vi.mocked(endOrderWithRefund).mockResolvedValue({ ok: true, order: {}, refundIssued: true });
    const pending = { id: "rr-1", status: "pending", orderId: ORDER, universityId: ASHESI, reason: "Shop was closed" };
    const prisma = makePrisma(paidOrder, pending);
    const audits: AuditInput[] = [];
    const app = await buildTestApp(refundRequestRoutes, { prisma, user: hq("accountant"), audits });
    const res = await app.inject({ method: "POST", url: "/rr-1/decide", payload: { decision: "approve" } });
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(endOrderWithRefund).mock.calls[0]?.[0]).toMatchObject({ orderId: ORDER, intent: "refund" });
    expect(prisma.refundRequest.update.mock.calls[0]?.[0].data).toMatchObject({ status: "approved", decidedById: "hq-accountant" });
    expect(audits.map((a) => a.action)).toContain("refund.request_approved");
  });

  test("a Paystack failure marks the request failed so HQ can retry", async () => {
    vi.mocked(endOrderWithRefund).mockResolvedValue({ ok: false, code: 502, error: "Transaction reversed already" });
    const pending = { id: "rr-1", status: "pending", orderId: ORDER, universityId: ASHESI, reason: "x" };
    const prisma = makePrisma(paidOrder, pending);
    const app = await buildTestApp(refundRequestRoutes, { prisma, user: hq("claims_officer") });
    const res = await app.inject({ method: "POST", url: "/rr-1/decide", payload: { decision: "approve" } });
    expect(res.statusCode).toBe(502);
    expect(prisma.refundRequest.update.mock.calls[0]?.[0].data).toMatchObject({ status: "failed", failureDetail: "Transaction reversed already" });
  });

  test("rejecting needs a reason, and moves no money", async () => {
    const pending = { id: "rr-1", status: "pending", orderId: ORDER, universityId: ASHESI, reason: "x" };
    const app = await buildTestApp(refundRequestRoutes, { prisma: makePrisma(paidOrder, pending), user: hq("owner") });
    expect((await app.inject({ method: "POST", url: "/rr-1/decide", payload: { decision: "reject" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/rr-1/decide", payload: { decision: "reject", note: "Student collected the order" } })).statusCode).toBe(200);
    expect(endOrderWithRefund).not.toHaveBeenCalled();
  });
});
