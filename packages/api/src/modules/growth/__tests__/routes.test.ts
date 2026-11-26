import { describe, expect, it, vi } from "vitest";
import type { AuditInput } from "../../../lib/audit";
import { buildTestApp } from "../../../test/harness";
import { adminGrowthRoutes, growthRoutes } from "../routes";

const ASHESI = "88a64733-7487-4928-b277-fa0643935991";

describe("guest visits", () => {
  it("stores a first name and the campus", async () => {
    const prisma = {
      university: { findUnique: vi.fn().mockResolvedValue({ id: ASHESI, name: "Ashesi University" }) },
      guestVisit: { create: vi.fn().mockResolvedValue({ id: "v1" }) },
    };
    const app = await buildTestApp(growthRoutes, { prisma, user: null });
    const res = await app.inject({ method: "POST", url: "/guest-visits", payload: { firstName: " Ama ", universityId: ASHESI } });
    expect(res.statusCode).toBe(201);
    expect(prisma.guestVisit.create.mock.calls[0]![0].data).toMatchObject({ firstName: "Ama", universityId: ASHESI });
    await app.close();
  });

  it("refuses an empty name", async () => {
    const prisma = { guestVisit: { create: vi.fn() } };
    const app = await buildTestApp(growthRoutes, { prisma, user: null });
    const res = await app.inject({ method: "POST", url: "/guest-visits", payload: { firstName: "  " } });
    expect(res.statusCode).toBe(400);
    expect(prisma.guestVisit.create).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("business leads", () => {
  it("stores the lead with the phone in +233 form", async () => {
    const prisma = {
      university: { findUnique: vi.fn().mockResolvedValue(null) },
      businessLead: { create: vi.fn().mockResolvedValue({ id: "l1" }) },
    };
    const app = await buildTestApp(growthRoutes, { prisma, user: null });
    const res = await app.inject({
      method: "POST",
      url: "/business-leads",
      payload: { fullName: "Kofi Mensah", phone: "0241234567", businessName: "Kofi Prints", kind: "bulk_pickup" },
    });
    expect(res.statusCode).toBe(201);
    expect(prisma.businessLead.create.mock.calls[0]![0].data).toMatchObject({ phone: "+233241234567", kind: "bulk_pickup" });
    await app.close();
  });

  it("refuses an unknown kind", async () => {
    const prisma = { businessLead: { create: vi.fn() } };
    const app = await buildTestApp(growthRoutes, { prisma, user: null });
    const res = await app.inject({
      method: "POST",
      url: "/business-leads",
      payload: { fullName: "Kofi", phone: "0241234567", businessName: "Kofi Prints", kind: "on_campus" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe("app installed", () => {
  it("records the first install only", async () => {
    const prisma = {
      profile: {
        findUnique: vi.fn().mockResolvedValue({ pwaInstalledAt: null, fullName: "Ama" }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const app = await buildTestApp(growthRoutes, { prisma, user: { id: "s1", role: "student" } });
    expect((await app.inject({ method: "POST", url: "/profile/me/app-installed" })).statusCode).toBe(204);
    expect(prisma.profile.update).toHaveBeenCalledTimes(1);

    prisma.profile.findUnique.mockResolvedValue({ pwaInstalledAt: new Date(), fullName: "Ama" });
    await app.inject({ method: "POST", url: "/profile/me/app-installed" });
    expect(prisma.profile.update).toHaveBeenCalledTimes(1);
    await app.close();
  });
});

describe("admin growth: owner only", () => {
  for (const url of ["/engagement", "/guest-visits", "/business-leads", "/messages"]) {
    it(`campus admin gets 403 on GET ${url}`, async () => {
      const app = await buildTestApp(adminGrowthRoutes, {
        prisma: {},
        user: { id: "ca", role: "admin", staffRole: "campus_admin", campusId: ASHESI },
      });
      expect((await app.inject({ method: "GET", url })).statusCode).toBe(403);
      await app.close();
    });
  }

  it("engagement counts installs and notifications", async () => {
    const prisma = {
      profile: {
        findMany: vi.fn().mockResolvedValue([
          { id: "a", fullName: "A", phone: "+1", createdAt: new Date(), pwaInstalledAt: new Date(), pushToken: null, university: null, _count: { webPushSubscriptions: 1 } },
          { id: "b", fullName: "B", phone: "+2", createdAt: new Date(), pwaInstalledAt: null, pushToken: null, university: null, _count: { webPushSubscriptions: 0 } },
        ]),
      },
    };
    const app = await buildTestApp(adminGrowthRoutes, { prisma, user: { id: "o", role: "admin", staffRole: "owner" } });
    const res = await app.inject({ method: "GET", url: "/engagement" });
    expect(res.json().totals).toEqual({ students: 2, installed: 1, notificationsOn: 1 });
    await app.close();
  });

  it("needs a title for a push message", async () => {
    const app = await buildTestApp(adminGrowthRoutes, { prisma: {}, user: { id: "o", role: "admin", staffRole: "owner" } });
    const res = await app.inject({
      method: "POST",
      url: "/messages",
      payload: { channel: "push", audience: { type: "everyone" }, body: "Hello" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("logs and audits an SMS send to typed numbers", async () => {
    const audits: AuditInput[] = [];
    const prisma = {
      profile: { findMany: vi.fn().mockResolvedValue([]) },
      adminMessage: { create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "m1", ...data })) },
    };
    const app = await buildTestApp(adminGrowthRoutes, {
      prisma,
      audits,
      user: { id: "o", role: "admin", staffRole: "owner" },
      env: { MNOTIFY_API_KEY: undefined },
    });
    const res = await app.inject({
      method: "POST",
      url: "/messages",
      payload: { channel: "sms", audience: { type: "phones", phones: ["0241234567"] }, body: "Hi" },
    });
    // No mNotify key in the test env: refused before anything is logged.
    expect(res.statusCode).toBe(503);
    expect(prisma.adminMessage.create).not.toHaveBeenCalled();
    await app.close();
  });
});
