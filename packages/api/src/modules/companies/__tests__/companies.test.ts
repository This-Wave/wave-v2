import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";
import { companyPayFor, hasPermission } from "@wave/shared";
import { companyRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

const CO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const owner = { id: "o", role: "admin" as Role, staffRole: "owner" };

beforeEach(() => vi.clearAllMocks());

describe("who manages companies", () => {
  test("owner and logistics head, nobody else", () => {
    expect(hasPermission("owner", "companies.manage")).toBe(true);
    expect(hasPermission("logistics_head", "companies.manage")).toBe(true);
    for (const r of ["accountant", "support", "auditor", "campus_admin", "claims_officer"]) {
      expect(hasPermission(r, "companies.manage")).toBe(false);
    }
  });

  test("support gets a 403", async () => {
    const app = await buildTestApp(companyRoutes, { prisma: {}, user: { id: "s", role: "admin" as Role, staffRole: "support" } });
    expect((await app.inject({ method: "GET", url: "/companies" })).statusCode).toBe(403);
  });
});

describe("the company / independent switch", () => {
  function prisma(company: unknown) {
    return {
      platformConfig: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn((x) => x),
      },
      deliveryCompany: { findUnique: vi.fn().mockResolvedValue(company) },
      $transaction: vi.fn().mockResolvedValue([]),
    };
  }

  test("company mode needs a company", async () => {
    const app = await buildTestApp(companyRoutes, { prisma: prisma(null), user: owner });
    const res = await app.inject({ method: "PUT", url: "/delivery-mode", payload: { mode: "company" } });
    expect(res.statusCode).toBe(400);
  });

  test("refuses a deactivated company", async () => {
    const app = await buildTestApp(companyRoutes, { prisma: prisma({ isActive: false }), user: owner });
    const res = await app.inject({ method: "PUT", url: "/delivery-mode", payload: { mode: "company", companyId: CO } });
    expect(res.statusCode).toBe(400);
  });

  test("switches when the company has a rider, and back to independent any time", async () => {
    const p = prisma({ isActive: true, members: [{ id: "r" }] });
    const app = await buildTestApp(companyRoutes, { prisma: p, user: owner });
    expect((await app.inject({ method: "PUT", url: "/delivery-mode", payload: { mode: "company", companyId: CO } })).statusCode).toBe(200);
    expect(p.$transaction.mock.calls[0]?.[0]).toHaveLength(2);
    expect((await app.inject({ method: "PUT", url: "/delivery-mode", payload: { mode: "independent" } })).statusCode).toBe(200);
    expect(p.$transaction.mock.calls[1]?.[0]).toHaveLength(1);
  });

  test("saves the packing point address with the switch", async () => {
    const p = prisma({ isActive: true, members: [{ id: "r" }] });
    const app = await buildTestApp(companyRoutes, { prisma: p, user: owner });
    await app.inject({ method: "PUT", url: "/delivery-mode", payload: { mode: "independent", hubAddress: "Wave hub, Berekuso" } });
    expect(p.$transaction.mock.calls[0]?.[0]).toHaveLength(2);
  });
});

describe("roster", () => {
  test("adding a rider by phone vouches for them", async () => {
    const p = {
      deliveryCompany: { findUnique: vi.fn().mockResolvedValue({ id: CO, name: "Swift" }) },
      profile: {
        findUnique: vi.fn().mockResolvedValue({ id: "p", role: "student", fullName: "Kofi", isActive: true, companyId: null }),
        update: vi.fn().mockResolvedValue({ id: "p" }),
      },
    };
    const app = await buildTestApp(companyRoutes, { prisma: p, user: owner });
    const res = await app.inject({ method: "POST", url: `/companies/${CO}/members`, payload: { phone: "241234567", as: "rider" } });
    expect(res.statusCode).toBe(201);
    expect(p.profile.update.mock.calls[0]?.[0].data).toMatchObject({ role: "rider", companyId: CO, isVerified: true });
  });

  test("a shop owner or staff can't be put on a roster", async () => {
    for (const role of ["shop_owner", "admin"]) {
      const p = {
        deliveryCompany: { findUnique: vi.fn().mockResolvedValue({ id: CO, name: "Swift" }) },
        profile: { findUnique: vi.fn().mockResolvedValue({ id: "p", role, fullName: "X", isActive: true, companyId: null }), update: vi.fn() },
      };
      const app = await buildTestApp(companyRoutes, { prisma: p, user: owner });
      const res = await app.inject({ method: "POST", url: `/companies/${CO}/members`, payload: { phone: "241234567", as: "rider" } });
      expect(res.statusCode).toBe(409);
      expect(p.profile.update).not.toHaveBeenCalled();
    }
  });

  test("can't remove a rider holding a job in progress", async () => {
    const p = {
      profile: { findUnique: vi.fn().mockResolvedValue({ id: "p", role: "rider", companyId: CO, fullName: "Kofi" }), update: vi.fn() },
      order: { count: vi.fn().mockResolvedValue(2) },
    };
    const app = await buildTestApp(companyRoutes, { prisma: p, user: owner });
    expect((await app.inject({ method: "DELETE", url: `/companies/${CO}/members/p` })).statusCode).toBe(409);
    expect(p.profile.update).not.toHaveBeenCalled();
  });
});

describe("company pay", () => {
  test("null until a rate is set", () => {
    expect(companyPayFor(20, { rateType: null, rateValue: null })).toBeNull();
  });
  test("flat and percent", () => {
    expect(companyPayFor(20, { rateType: "flat", rateValue: 12 })).toBe(12);
    expect(companyPayFor(80, { rateType: "percent", rateValue: 75 })).toBe(60);
  });
});
