import { describe, expect, test, vi } from "vitest";
import type { Role } from "../../../plugins/auth";
import type { AuditInput } from "../../../lib/audit";
import { adminSwitchRoutes, serviceStatusRoutes } from "../routes";
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
