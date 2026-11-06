import { describe, expect, test, vi, beforeEach } from "vitest";
import { ROLE_PERMISSIONS, hasPermission, type StaffRole } from "@wave/shared";
import type { Role } from "../../../plugins/auth";
import type { AuditInput } from "../../../lib/audit";

vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));
vi.mock("../../suggestions/announce", () => ({ announceShopIsLive: vi.fn() }));

import { staffRoutes } from "../routes";
import { adminRoutes } from "../../admin/routes";
import { buildTestApp } from "../../../test/harness";

const staff = (staffRole: StaffRole | null, id = "me") => ({ id, role: "admin" as Role, staffRole });

describe("ROLE_PERMISSIONS", () => {
  test("only the owner manages staff", () => {
    const managers = Object.entries(ROLE_PERMISSIONS)
      .filter(([, perms]) => perms.includes("staff.manage"))
      .map(([role]) => role);
    expect(managers).toEqual(["owner"]);
  });

  test("the auditor can read the whole log and change nothing", () => {
    const perms = ROLE_PERMISSIONS.auditor;
    expect(perms).toContain("audit.read_all");
    expect(perms.filter((p) => p !== "ops.read" && p !== "pii.read" && p !== "payments.read" && p !== "audit.read_all")).toEqual([]);
  });

  test("the accountant cannot see phone numbers or move money out", () => {
    expect(hasPermission("accountant", "pii.read")).toBe(false);
    expect(hasPermission("accountant", "refunds.issue")).toBe(false);
  });

  test("no role, or an unknown one, grants nothing", () => {
    expect(hasPermission(null, "ops.read")).toBe(false);
    expect(hasPermission("superuser", "ops.read")).toBe(false);
  });
});

describe("requirePermission on admin routes", () => {
  const prisma = {
    platformConfig: { findUnique: vi.fn(), upsert: vi.fn().mockResolvedValue({ key: "delivery_fee_base", value: "20" }) },
    profile: {
      findMany: vi.fn().mockResolvedValue([{ id: "u1", phone: "+233241234589" }]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  beforeEach(() => vi.clearAllMocks());

  test("a support login cannot change pricing", async () => {
    const app = await buildTestApp(adminRoutes, { prisma, user: staff("support") });
    const res = await app.inject({ method: "PUT", url: "/config", payload: { key: "delivery_fee_base", value: "1" } });
    expect(res.statusCode).toBe(403);
    expect(prisma.platformConfig.upsert).not.toHaveBeenCalled();
  });

  test("an accountant can, and the change is audited with before and after", async () => {
    const audits: AuditInput[] = [];
    prisma.platformConfig.findUnique.mockResolvedValue({ key: "delivery_fee_base", value: "20" });
    const app = await buildTestApp(adminRoutes, { prisma, user: staff("accountant"), audits });
    const res = await app.inject({ method: "PUT", url: "/config", payload: { key: "delivery_fee_base", value: "20" } });
    expect(res.statusCode).toBe(200);
    expect(audits[0]).toMatchObject({ action: "config.changed", before: { value: "20" } });
  });

  test("an accountant sees users with masked phone numbers", async () => {
    const app = await buildTestApp(adminRoutes, { prisma, user: staff("accountant") });
    const res = await app.inject({ method: "GET", url: "/users" });
    expect(res.json().users[0].phone).toBe("+233•••••••89");
  });

  test("support sees full numbers, and the viewing is logged", async () => {
    const audits: AuditInput[] = [];
    const app = await buildTestApp(adminRoutes, { prisma, user: staff("support"), audits });
    const res = await app.inject({ method: "GET", url: "/users" });
    expect(res.json().users[0].phone).toBe("+233241234589");
    expect(audits[0]).toMatchObject({ action: "pii.user_list_viewed", category: "pii" });
  });

  test("an admin with no staff role can't read anything", async () => {
    const app = await buildTestApp(adminRoutes, { prisma, user: staff(null) });
    const res = await app.inject({ method: "GET", url: "/users" });
    expect(res.statusCode).toBe(403);
  });

  test("support can't make anyone staff through the users page", async () => {
    prisma.profile.findUnique.mockResolvedValue({ role: "student" });
    const app = await buildTestApp(adminRoutes, { prisma, user: staff("support") });
    const res = await app.inject({ method: "PATCH", url: "/users/u2/role", payload: { role: "admin" } });
    expect(res.statusCode).toBe(403);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  test("support can't ban an owner", async () => {
    prisma.profile.findUnique.mockResolvedValue({ role: "admin", isActive: true });
    const app = await buildTestApp(adminRoutes, { prisma, user: staff("support") });
    const res = await app.inject({ method: "PATCH", url: "/users/o1/status", payload: { isActive: false } });
    expect(res.statusCode).toBe(403);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });
});

describe("staff routes", () => {
  function makePrisma() {
    return {
      profile: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "p1", ...data })),
        count: vi.fn().mockResolvedValue(2),
      },
    };
  }

  test("only an owner may list staff", async () => {
    const app = await buildTestApp(staffRoutes, { prisma: makePrisma(), user: staff("logistics_head") });
    expect((await app.inject({ method: "GET", url: "/" })).statusCode).toBe(403);
  });

  test("any staff member can read their own permissions", async () => {
    const app = await buildTestApp(staffRoutes, { prisma: makePrisma(), user: staff("auditor") });
    const res = await app.inject({ method: "GET", url: "/me" });
    expect(res.json()).toMatchObject({ staffRole: "auditor" });
    expect(res.json().permissions).toContain("audit.read_all");
  });

  test("adds a person by the number they sign in with, however it was typed", async () => {
    const prisma = makePrisma();
    const audits: AuditInput[] = [];
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", role: "student", fullName: "Ama", isActive: true });
    const app = await buildTestApp(staffRoutes, { prisma, user: staff("owner"), audits });
    const res = await app.inject({ method: "POST", url: "/", payload: { phone: "024 123 4589", staffRole: "accountant" } });
    expect(res.statusCode).toBe(201);
    expect(prisma.profile.findUnique.mock.calls[0]?.[0]).toMatchObject({ where: { phone: "+233241234589" } });
    expect(prisma.profile.update.mock.calls[0]?.[0].data).toEqual({ role: "admin", staffRole: "accountant" });
    expect(audits[0]).toMatchObject({ action: "staff.added", before: { role: "student" } });
  });

  test("refuses a number with no Wave account", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue(null);
    const app = await buildTestApp(staffRoutes, { prisma, user: staff("owner") });
    const res = await app.inject({ method: "POST", url: "/", payload: { phone: "0241234589", staffRole: "support" } });
    expect(res.statusCode).toBe(404);
  });

  test("won't demote the last owner", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ role: "admin", staffRole: "owner", fullName: "Kweku" });
    prisma.profile.count.mockResolvedValue(1);
    const app = await buildTestApp(staffRoutes, { prisma, user: staff("owner", "other-owner") });
    const res = await app.inject({ method: "PATCH", url: "/o1", payload: { staffRole: "auditor" } });
    expect(res.statusCode).toBe(409);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  test("won't let an owner change or remove themselves", async () => {
    const app = await buildTestApp(staffRoutes, { prisma: makePrisma(), user: staff("owner", "o1") });
    expect((await app.inject({ method: "PATCH", url: "/o1", payload: { staffRole: "auditor" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: "/o1", payload: { revertTo: "student" } })).statusCode).toBe(400);
  });

  test("removing staff puts them back to a customer role", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ role: "admin", staffRole: "support", fullName: "Esi" });
    const app = await buildTestApp(staffRoutes, { prisma, user: staff("owner") });
    const res = await app.inject({ method: "DELETE", url: "/s1", payload: { revertTo: "rider" } });
    expect(res.statusCode).toBe(204);
    expect(prisma.profile.update.mock.calls[0]?.[0].data).toEqual({ role: "rider", staffRole: null, adminUniversityId: null });
  });
});
