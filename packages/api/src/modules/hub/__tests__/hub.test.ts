import { describe, expect, test, vi, beforeEach } from "vitest";
import type { Role } from "../../../plugins/auth";

vi.mock("../../notifications/dispatch", () => ({ pushToProfiles: vi.fn().mockResolvedValue({ sent: 0 }) }));

import { hubRoutes } from "../routes";
import { pushToProfiles } from "../../notifications/dispatch";
import { buildTestApp } from "../../../test/harness";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const owner = { id: "o", role: "admin" as Role, staffRole: "owner" };

function prisma(moving: { id: string; studentId: string }[]) {
  return {
    order: {
      findMany: vi.fn().mockResolvedValue(moving.map((m) => ({ ...m, checkpoint: { name: "Ashesi Quad" } }))),
      updateMany: vi.fn().mockResolvedValue({ count: moving.length }),
    },
    orderStatusHistory: { createMany: vi.fn() },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("packing point", () => {
  test("support can't use it; logistics head and campus admins can", async () => {
    const app = await buildTestApp(hubRoutes, { prisma: prisma([]), user: { id: "s", role: "admin" as Role, staffRole: "support" } });
    expect((await app.inject({ method: "GET", url: "/hub" })).statusCode).toBe(403);
  });

  test("received moves collecting orders to packing and tells each student", async () => {
    const p = prisma([{ id: A, studentId: "s1" }, { id: B, studentId: "s2" }]);
    const app = await buildTestApp(hubRoutes, { prisma: p, user: owner });
    const res = await app.inject({ method: "POST", url: "/hub/received", payload: { orderIds: [A, B] } });
    expect(res.json()).toEqual({ moved: 2 });
    expect(p.order.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { status: "rider_assigned", companyId: { not: null } },
      data: { status: "en_route" },
    });
    expect(pushToProfiles).toHaveBeenCalledTimes(2);
  });

  test("ready names the checkpoint, never the company", async () => {
    const p = prisma([{ id: A, studentId: "s1" }]);
    const app = await buildTestApp(hubRoutes, { prisma: p, user: owner });
    await app.inject({ method: "POST", url: "/hub/ready", payload: { orderIds: [A] } });
    const payload = (pushToProfiles as unknown as { mock: { calls: { payload: { body: string } }[][] } }).mock.calls[0]![0]!.payload;
    expect(payload.body).toBe("Your Wave bag is at Ashesi Quad.");
    expect(p.order.updateMany.mock.calls[0]?.[0].where.status).toBe("en_route");
  });

  test("pressing twice is a 409, not a second round of messages", async () => {
    const app = await buildTestApp(hubRoutes, { prisma: prisma([]), user: owner });
    const res = await app.inject({ method: "POST", url: "/hub/received", payload: { orderIds: [A] } });
    expect(res.statusCode).toBe(409);
    expect(pushToProfiles).not.toHaveBeenCalled();
  });

  test("a campus admin only moves their campus's orders", async () => {
    const p = prisma([{ id: A, studentId: "s1" }]);
    const app = await buildTestApp(hubRoutes, { prisma: p, user: { id: "c", role: "admin" as Role, staffRole: "campus_admin", campusId: "uni-1" } });
    await app.inject({ method: "POST", url: "/hub/received", payload: { orderIds: [A] } });
    expect(p.order.findMany.mock.calls[0]?.[0].where.universityId).toBe("uni-1");
  });
});
