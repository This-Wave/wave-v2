import { describe, expect, test, vi } from "vitest";
import type { Role } from "../../../plugins/auth";
import type { AuditInput } from "../../../lib/audit";
import { adminSwitchRoutes, serviceStatusRoutes } from "../routes";
import { shopRoutes } from "../../shops/routes";
import { productRoutes } from "../../products/routes";
import { buildTestApp } from "../../../test/harness";

const UNI = "7f1c2a4e-0000-4000-8000-000000000001";
const staff = (staffRole: string) => ({ id: "s1", role: "admin" as Role, staffRole });

function makePrisma(rows: unknown[] = []) {
  return {
    serviceSwitch: {
      findMany: vi.fn().mockResolvedValue(rows),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      deleteMany: vi.fn(),
    },
    university: { findUnique: vi.fn().mockResolvedValue({ id: UNI }), findMany: vi.fn().mockResolvedValue([]) },
  };
}

describe("GET /service-status", () => {
  test("answers without a session, with both services", async () => {
    const prisma = makePrisma([{ key: "buy_for_me", universityId: null, paused: true, message: "Back at 6", resumeAt: null }]);
    const app = await buildTestApp(serviceStatusRoutes, { prisma, user: null });
    const res = await app.inject({ method: "GET", url: `/service-status?universityId=${UNI}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toMatchObject({
      buy_for_me: { paused: true, message: "Back at 6" },
      pickup: { paused: false },
    });
  });
});

describe("PUT /admin/switches", () => {
  test("logistics can pause, and the pause is audited with the message", async () => {
    const prisma = makePrisma();
    const audits: AuditInput[] = [];
    const app = await buildTestApp(adminSwitchRoutes, { prisma, user: staff("logistics_head"), audits });
    const res = await app.inject({
      method: "PUT",
      url: "/switches",
      payload: { key: "buy_for_me", universityId: null, paused: true, message: "Exams week" },
    });
    expect(res.statusCode).toBe(200);
    expect(prisma.serviceSwitch.create.mock.calls[0]?.[0].data).toMatchObject({ key: "buy_for_me", paused: true, message: "Exams week" });
    expect(audits[0]).toMatchObject({ action: "switch.paused", category: "switch", after: { paused: true, message: "Exams week" } });
  });

  test("an accountant cannot", async () => {
    const prisma = makePrisma();
    const app = await buildTestApp(adminSwitchRoutes, { prisma, user: staff("accountant") });
    const res = await app.inject({ method: "PUT", url: "/switches", payload: { key: "buy_for_me", universityId: null, paused: true } });
    expect(res.statusCode).toBe(403);
    expect(prisma.serviceSwitch.create).not.toHaveBeenCalled();
  });

  test("refuses a resume time in the past", async () => {
    const app = await buildTestApp(adminSwitchRoutes, { prisma: makePrisma(), user: staff("owner") });
    const res = await app.inject({
      method: "PUT",
      url: "/switches",
      payload: { key: "pickup", universityId: null, paused: true, resumeAt: "2020-01-01T00:00:00Z" },
    });
    expect(res.statusCode).toBe(400);
  });

  test("resuming clears the message and the timer", async () => {
    const prisma = makePrisma();
    prisma.serviceSwitch.findFirst.mockResolvedValue({ id: "row1", key: "pickup", universityId: null, paused: true, message: "x", resumeAt: null });
    const app = await buildTestApp(adminSwitchRoutes, { prisma, user: staff("owner") });
    await app.inject({ method: "PUT", url: "/switches", payload: { key: "pickup", universityId: null, paused: false, message: "ignored" } });
    expect(prisma.serviceSwitch.update.mock.calls[0]?.[0].data).toMatchObject({ paused: false, message: null, resumeAt: null });
  });
});

describe("before Buy for me launches", () => {
  const prelaunch = [
    { key: "buy_for_me", universityId: null, paused: true, hidden: true, message: "Coming soon — we're signing up shops.", resumeAt: null },
  ];

  test("the shop list is closed, not empty-looking", async () => {
    const prisma = { ...makePrisma(prelaunch), shop: { findMany: vi.fn().mockResolvedValue([{ id: "s1" }]) } };
    const app = await buildTestApp(shopRoutes, { prisma, user: null });
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: "service_not_launched", error: "Coming soon — we're signing up shops.", shops: [] });
    expect(prisma.shop.findMany).not.toHaveBeenCalled();
  });

  test("a shop's menu is closed too", async () => {
    const prisma = {
      ...makePrisma(prelaunch),
      shop: { findUnique: vi.fn().mockResolvedValue({ universityId: UNI }) },
      product: { findMany: vi.fn() },
    };
    const app = await buildTestApp(productRoutes, { prisma, user: null });
    const res = await app.inject({ method: "GET", url: "/shops/s1/products" });
    expect(res.statusCode).toBe(503);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  test("an ordinary pause leaves browsing open — only ordering stops", async () => {
    const paused = [{ key: "buy_for_me", universityId: null, paused: true, hidden: false, message: "Back at 6", resumeAt: null }];
    const prisma = { ...makePrisma(paused), shop: { findMany: vi.fn().mockResolvedValue([{ id: "s1" }]) } };
    const app = await buildTestApp(shopRoutes, { prisma, user: null });
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.json().shops).toHaveLength(1);
  });

  test("opening it clears hidden, so resuming later reads as a pause", async () => {
    const prisma = makePrisma();
    prisma.serviceSwitch.findFirst.mockResolvedValue({ id: "row1", key: "buy_for_me", universityId: null, paused: true, hidden: true, message: "Coming soon", resumeAt: null });
    const audits: AuditInput[] = [];
    const app = await buildTestApp(adminSwitchRoutes, { prisma, user: staff("owner"), audits });
    const res = await app.inject({ method: "PUT", url: "/switches", payload: { key: "buy_for_me", universityId: null, paused: false } });
    expect(res.statusCode).toBe(200);
    expect(prisma.serviceSwitch.update.mock.calls[0]?.[0].data).toMatchObject({ paused: false, hidden: false });
    expect(audits[0]).toMatchObject({ action: "switch.launched" });
  });

  test("a campus admin cannot un-launch a service", async () => {
    const prisma = makePrisma();
    prisma.serviceSwitch.findFirst.mockResolvedValue(null);
    const app = await buildTestApp(adminSwitchRoutes, {
      prisma,
      user: { id: "ca", role: "admin" as Role, staffRole: "campus_admin", campusId: UNI },
    });
    const res = await app.inject({ method: "PUT", url: "/switches", payload: { key: "buy_for_me", universityId: UNI, paused: true, hidden: true } });
    // Allowed to pause their campus, but `hidden` is HQ's: it is ignored.
    expect(res.statusCode).toBe(200);
    expect(prisma.serviceSwitch.create.mock.calls[0]?.[0].data).toMatchObject({ paused: true, hidden: false });
  });
});
