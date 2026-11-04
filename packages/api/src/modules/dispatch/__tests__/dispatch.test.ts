import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus: vi.fn(),
  notifyGoodsCostRecorded: vi.fn(),
  pushToProfiles: vi.fn().mockResolvedValue({ sent: 0 }),
}));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));

import { dispatchRoutes } from "../routes";
import { orderRoutes } from "../../orders/routes";
import { notifyOrderStatus } from "../../notifications/dispatch";
import { buildTestApp } from "../../../test/harness";

const CO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_CO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RIDER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ORDER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const dispatcher = { id: "disp-1", role: "dispatcher" as Role, companyId: CO };

/** platform_config rows saying company mode is on, run by `companyId`. */
function companyMode(companyId: string | null = CO) {
  return {
    findMany: vi.fn().mockResolvedValue([
      { key: "delivery_mode", value: "company" },
      ...(companyId ? [{ key: "delivery_company_id", value: companyId }] : []),
    ]),
    findUnique: vi.fn().mockResolvedValue(null),
  };
}

function prismaFor(order: Record<string, unknown> | null, rider: Record<string, unknown> | null) {
  return {
    platformConfig: companyMode(),
    deliveryCompany: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        name: where.id === CO ? "Swift Riders" : "Other Co",
        isActive: true,
      })),
    },
    profile: { findUnique: vi.fn().mockResolvedValue(rider), findMany: vi.fn().mockResolvedValue([]) },
    order: {
      findUnique: vi.fn().mockResolvedValue(order),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: ORDER, itemDescription: "Jollof", student: { fullName: "Ama Owusu" } }),
    },
    orderStatusHistory: { create: vi.fn() },
  };
}

const ourRider = { id: RIDER, role: "rider", companyId: CO, isActive: true, fullName: "Kofi" };

beforeEach(() => vi.clearAllMocks());

describe("dispatch: who gets in", () => {
  test("a student, a rider or staff can't open the run sheet", async () => {
    for (const user of [
      { id: "s", role: "student" as Role },
      { id: "r", role: "rider" as Role, companyId: CO },
      { id: "a", role: "admin" as Role, staffRole: "owner" },
    ]) {
      const app = await buildTestApp(dispatchRoutes, { prisma: prismaFor(null, null), user });
      expect((await app.inject({ method: "GET", url: "/run-sheet" })).statusCode).toBe(403);
    }
  });

  test("a dispatcher with no company is refused", async () => {
    const app = await buildTestApp(dispatchRoutes, {
      prisma: prismaFor(null, null),
      user: { ...dispatcher, companyId: null },
    });
    expect((await app.inject({ method: "GET", url: "/run-sheet" })).statusCode).toBe(403);
  });
});

describe("dispatch: the run sheet", () => {
  test("the active company sees its own orders plus unassigned paid ones", async () => {
    const prisma = prismaFor(null, null);
    const app = await buildTestApp(dispatchRoutes, { prisma, user: dispatcher });
    const res = await app.inject({ method: "GET", url: "/run-sheet?date=2026-11-05" });
    expect(res.statusCode).toBe(200);
    const where = prisma.order.findMany.mock.calls[0]?.[0].where;
    expect(where.OR).toEqual([
      { companyId: CO },
      { companyId: null, riderId: null, status: "confirmed" },
    ]);
    expect(res.json().receivingOrders).toBe(true);
  });

  test("a company that is not the active one sees only its own orders", async () => {
    const prisma = prismaFor(null, null);
    prisma.platformConfig = companyMode(OTHER_CO);
    const app = await buildTestApp(dispatchRoutes, { prisma, user: dispatcher });
    const res = await app.inject({ method: "GET", url: "/run-sheet" });
    expect(prisma.order.findMany.mock.calls[0]?.[0].where.OR).toEqual([{ companyId: CO }]);
    expect(res.json().receivingOrders).toBe(false);
  });

  test("the sheet carries the student's first name only, never a phone", async () => {
    const prisma = prismaFor(null, null);
    prisma.order.findMany.mockResolvedValue([
      { id: ORDER, status: "confirmed", riderId: null, student: { fullName: "Ama Serwaa Owusu" } },
    ]);
    const app = await buildTestApp(dispatchRoutes, { prisma, user: dispatcher });
    const order = (await app.inject({ method: "GET", url: "/run-sheet" })).json().orders[0];
    expect(order.studentFirstName).toBe("Ama");
    expect(order).not.toHaveProperty("student");
    expect(JSON.stringify(prisma.order.findMany.mock.calls[0]?.[0].select.student)).not.toMatch(/phone/);
  });
});

describe("dispatch: assigning", () => {
  test("assigns an unassigned order to one of our riders and tells the student", async () => {
    const prisma = prismaFor({ id: ORDER, status: "confirmed", riderId: null, companyId: null }, ourRider);
    const app = await buildTestApp(dispatchRoutes, { prisma, user: dispatcher });
    const res = await app.inject({ method: "POST", url: `/orders/${ORDER}/assign`, payload: { riderId: RIDER } });
    expect(res.statusCode).toBe(200);
    expect(prisma.order.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ORDER, status: "confirmed", riderId: null },
      data: { riderId: RIDER, companyId: CO, status: "rider_assigned" },
    });
    expect(notifyOrderStatus).toHaveBeenCalledOnce();
  });

  test("refuses a rider from another company", async () => {
    const prisma = prismaFor(
      { id: ORDER, status: "confirmed", riderId: null, companyId: null },
      { ...ourRider, companyId: OTHER_CO },
    );
    const app = await buildTestApp(dispatchRoutes, { prisma, user: dispatcher });
    const res = await app.inject({ method: "POST", url: `/orders/${ORDER}/assign`, payload: { riderId: RIDER } });
    expect(res.statusCode).toBe(400);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  test("another company's order is a 404", async () => {
    const prisma = prismaFor({ id: ORDER, status: "rider_assigned", riderId: "x", companyId: OTHER_CO }, ourRider);
    const app = await buildTestApp(dispatchRoutes, { prisma, user: dispatcher });
    const res = await app.inject({ method: "POST", url: `/orders/${ORDER}/assign`, payload: { riderId: RIDER } });
    expect(res.statusCode).toBe(404);
  });

  test("an order already on its way can't be moved", async () => {
    const prisma = prismaFor({ id: ORDER, status: "en_route", riderId: "x", companyId: CO }, ourRider);
    const app = await buildTestApp(dispatchRoutes, { prisma, user: dispatcher });
    const res = await app.inject({ method: "POST", url: `/orders/${ORDER}/assign`, payload: { riderId: RIDER } });
    expect(res.statusCode).toBe(409);
  });

  test("re-assigning does not notify the student a second time", async () => {
    const prisma = prismaFor({ id: ORDER, status: "rider_assigned", riderId: "old", companyId: CO }, ourRider);
    const app = await buildTestApp(dispatchRoutes, { prisma, user: dispatcher });
    const res = await app.inject({ method: "POST", url: `/orders/${ORDER}/assign`, payload: { riderId: RIDER } });
    expect(res.statusCode).toBe(200);
    expect(notifyOrderStatus).not.toHaveBeenCalled();
  });

  test("a lost race is a 409, not a 500", async () => {
    const prisma = prismaFor({ id: ORDER, status: "confirmed", riderId: null, companyId: null }, ourRider);
    prisma.order.update.mockRejectedValue(new Error("P2025"));
    const app = await buildTestApp(dispatchRoutes, { prisma, user: dispatcher });
    const res = await app.inject({ method: "POST", url: `/orders/${ORDER}/assign`, payload: { riderId: RIDER } });
    expect(res.statusCode).toBe(409);
  });
});

describe("rider feed in company mode", () => {
  test("the open feed is empty and says who assigns jobs", async () => {
    const prisma = {
      ...prismaFor(null, { isVerified: true, universityId: "u", riderType: "external" }),
    };
    const app = await buildTestApp(orderRoutes, { prisma, user: { id: RIDER, role: "rider" as Role } });
    const res = await app.inject({ method: "GET", url: "/available" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ orders: [], deliveryMode: "company", companyName: "Swift Riders" });
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  test("a rider can't claim a job themselves", async () => {
    const prisma = prismaFor(null, { isVerified: true, universityId: "u" });
    const app = await buildTestApp(orderRoutes, { prisma, user: { id: RIDER, role: "rider" as Role } });
    const res = await app.inject({ method: "PATCH", url: `/${ORDER}/accept` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/assigned by Swift Riders/);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
