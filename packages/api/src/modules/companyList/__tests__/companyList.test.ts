import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus: vi.fn(),
  notifyGoodsCostRecorded: vi.fn(),
  notifyLoyaltyProgress: vi.fn(),
  pushToProfiles: vi.fn().mockResolvedValue({ sent: 0 }),
}));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));

import { companyListRoutes } from "../routes";
import { companyRoutes } from "../../companies/routes";
import { orderRoutes } from "../../orders/routes";
import { hashListToken } from "../token";
import { pushToProfiles } from "../../notifications/dispatch";
import { buildTestApp } from "../../../test/harness";

const CO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN = "t".repeat(43);
const ORDER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function prisma(opts: { mode?: "company" | "independent"; companyActive?: boolean; fresh?: { id: string; studentId: string }[] } = {}) {
  const mode = opts.mode ?? "company";
  const fresh = opts.fresh ?? [];
  return {
    platformConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue(
        mode === "company"
          ? [{ key: "delivery_mode", value: "company" }, { key: "delivery_company_id", value: CO }]
          : [{ key: "delivery_mode", value: "independent" }],
      ),
    },
    deliveryCompany: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; listTokenHash?: string } }) => {
        if (where.listTokenHash && where.listTokenHash !== hashListToken(TOKEN)) return null;
        return { id: CO, name: "Swift Riders", isActive: opts.companyActive ?? true };
      }),
    },
    order: {
      findMany: (() => {
        const fn = vi.fn().mockResolvedValueOnce(fresh); // unclaimed paid orders
        // The route only asks which ones it took when there were some.
        if (fresh.length) fn.mockResolvedValueOnce(fresh);
        return fn;
      })().mockResolvedValue([
          { id: ORDER, status: "rider_assigned", orderType: "buy_for_me", itemDescription: "Water", shop: { name: "Fresh Mart", locationText: null }, checkpoint: { name: "Quad" }, university: { name: "Ashesi" }, student: { fullName: "Ama Owusu" } },
          { id: "eeeeeeee-0000-4000-8000-000000000000", status: "cancelled", orderType: "pickup", itemDescription: "Box", originCheckpoint: { name: "Zone A" }, checkpoint: { name: "Gate" }, university: { name: "Ashesi" }, student: { fullName: "Kojo" } },
        ]),
      updateMany: vi.fn().mockResolvedValue({ count: fresh.length }),
    },
    orderStatusHistory: { createMany: vi.fn() },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("the company's private list link", () => {
  test("a wrong or turned-off link is a 404 that says nothing more", async () => {
    const app = await buildTestApp(companyListRoutes, { prisma: prisma(), user: null });
    const res = await app.inject({ method: "GET", url: `/${"x".repeat(43)}` });
    expect(res.statusCode).toBe(404);
    const off = await buildTestApp(companyListRoutes, { prisma: prisma({ companyActive: false }), user: null });
    expect((await off.inject({ method: "GET", url: `/${TOKEN}` })).statusCode).toBe(404);
  });

  test("opening it hands over paid orders and tells the students", async () => {
    const p = prisma({ fresh: [{ id: ORDER, studentId: "s1" }] });
    const app = await buildTestApp(companyListRoutes, { prisma: p, user: null });
    const res = await app.inject({ method: "GET", url: `/${TOKEN}?date=2026-11-05` });
    expect(res.statusCode).toBe(200);
    expect(p.order.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { status: "confirmed", companyId: null, riderId: null },
      data: { companyId: CO, status: "rider_assigned" },
    });
    expect(pushToProfiles).toHaveBeenCalledOnce();
    // Wave's voice only: the student is never told a company exists.
    const pushed = JSON.stringify((pushToProfiles as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]);
    expect(pushed).not.toMatch(/Swift|company/i);
    const body = res.json();
    expect(body.counts).toEqual({ toCollect: 1, done: 0, cancelled: 1 });
    expect(body.orders[0]).toMatchObject({ ref: "#WV-DDDDDD", from: "Fresh Mart", items: "Water" });
    expect(body.bringTo).toBe("the Wave packing point");
  });

  test("carries nothing about the student: no name, phone or checkpoint", async () => {
    const p = prisma();
    const app = await buildTestApp(companyListRoutes, { prisma: p, user: null });
    const res = await app.inject({ method: "GET", url: `/${TOKEN}` });
    expect(res.body).not.toMatch(/phone|Ama|Quad|student/i);
    const select = p.order.findMany.mock.calls.at(-1)?.[0].select;
    expect(select).not.toHaveProperty("student");
    expect(select).not.toHaveProperty("checkpoint");
  });

  test("hands nothing over once Wave switches back to independent riders", async () => {
    const p = prisma({ mode: "independent" });
    p.order.findMany = vi.fn().mockResolvedValue([]);
    const app = await buildTestApp(companyListRoutes, { prisma: p, user: null });
    const res = await app.inject({ method: "GET", url: `/${TOKEN}` });
    expect(res.statusCode).toBe(200);
    expect(p.order.updateMany).not.toHaveBeenCalled();
    expect(res.json().receivingOrders).toBe(false);
  });

  test("downloads as a spreadsheet with cancelled rows marked", async () => {
    const app = await buildTestApp(companyListRoutes, { prisma: prisma(), user: null });
    const res = await app.inject({ method: "GET", url: `/${TOKEN}?format=csv` });
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.body).toMatch(/CANCELLED - do not collect/);
  });
});

describe("making the link", () => {
  test("stores only the hash and returns the link once", async () => {
    const p = {
      deliveryCompany: {
        findUnique: vi.fn().mockResolvedValue({ id: CO, name: "Swift", listTokenHash: null }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const app = await buildTestApp(companyRoutes, { prisma: p, user: { id: "o", role: "admin" as Role, staffRole: "owner" } });
    const res = await app.inject({ method: "POST", url: `/companies/${CO}/list-link` });
    expect(res.statusCode).toBe(201);
    const { token, path } = res.json();
    expect(path).toBe(`/list/${token}`);
    expect(p.deliveryCompany.update.mock.calls[0]?.[0].data).toEqual({ listTokenHash: hashListToken(token) });
  });
});

describe("the student closes a company order", () => {
  test("'I have my order' works with no Wave rider on a company order", async () => {
    const p = {
      order: {
        findUnique: vi.fn().mockResolvedValue({ id: ORDER, studentId: "s1", riderId: null, companyId: CO, orderType: "buy_for_me", status: "rider_assigned", deliveryFee: "50" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderStatusHistory: { create: vi.fn() },
      studentDeliveryStats: { upsert: vi.fn().mockResolvedValue({ rewardStamps: 1 }) },
    };
    const app = await buildTestApp(orderRoutes, { prisma: p, user: { id: "s1", role: "student" as Role } });
    const res = await app.inject({ method: "POST", url: `/${ORDER}/confirm-receipt` });
    expect(res.statusCode).toBe(200);
    expect(p.order.updateMany.mock.calls[0]?.[0].where.status.in).toContain("rider_assigned");
  });

  test("an independent order with no rider still can't be closed", async () => {
    const p = { order: { findUnique: vi.fn().mockResolvedValue({ id: ORDER, studentId: "s1", riderId: null, companyId: null, status: "confirmed" }), updateMany: vi.fn() } };
    const app = await buildTestApp(orderRoutes, { prisma: p, user: { id: "s1", role: "student" as Role } });
    expect((await app.inject({ method: "POST", url: `/${ORDER}/confirm-receipt` })).statusCode).toBe(409);
  });
});
