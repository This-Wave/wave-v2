import { describe, expect, test, vi, beforeEach } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import type { Role } from "../../../plugins/auth";

vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));
vi.mock("../../suggestions/announce", () => ({ announceShopIsLive: vi.fn() }));

import { adminRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * `GET /admin/users` was `findMany({ where: role })` and nothing else: every
 * profile in the database, in one response, with every column — including
 * `email`, `studentId`, `avatarUrl` and `pushToken`, none of which the page
 * renders. Fine at pilot scale; a standing export of the user base later.
 */
const ADMIN = { id: "admin-1", role: "admin" as Role };

function makePrisma() {
  return {
    profile: {
      findMany: vi.fn().mockResolvedValue([{ id: "u1" }]),
      count: vi.fn().mockResolvedValue(140),
    },
  };
}

async function getUsers(
  prisma: ReturnType<typeof makePrisma>,
  query = "",
  user = ADMIN,
): Promise<LightMyRequestResponse> {
  const app = await buildTestApp(adminRoutes, { prisma, user });
  const res = await app.inject({ method: "GET", url: `/users${query}` });
  await app.close();
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /admin/users", () => {
  test("pages by default rather than returning everyone", async () => {
    const prisma = makePrisma();

    const res = await getUsers(prisma);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 140, page: 1, pageSize: 25 });
    expect(prisma.profile.findMany.mock.calls[0]?.[0]).toMatchObject({ take: 25, skip: 0 });
  });

  test("caps pageSize so the cap cannot be opted out of", async () => {
    const prisma = makePrisma();

    await getUsers(prisma, "?pageSize=5000");

    expect(prisma.profile.findMany.mock.calls[0]?.[0].take).toBe(100);
  });

  test("skips by page", async () => {
    const prisma = makePrisma();

    await getUsers(prisma, "?page=3&pageSize=10");

    expect(prisma.profile.findMany.mock.calls[0]?.[0]).toMatchObject({ take: 10, skip: 20 });
  });

  test("a nonsense page does not produce a negative skip", async () => {
    const prisma = makePrisma();

    await getUsers(prisma, "?page=0");

    expect(prisma.profile.findMany.mock.calls[0]?.[0].skip).toBe(0);
  });

  test("selects only the columns the page renders", async () => {
    const prisma = makePrisma();

    await getUsers(prisma);

    const select = prisma.profile.findMany.mock.calls[0]?.[0].select;
    expect(select).toMatchObject({ id: true, fullName: true, phone: true, role: true });
    expect(select).not.toHaveProperty("email");
    expect(select).not.toHaveProperty("studentId");
    expect(select).not.toHaveProperty("pushToken");
  });

  test("searches server-side, because the browser only has one page now", async () => {
    const prisma = makePrisma();

    await getUsers(prisma, "?search=Ama");

    expect(prisma.profile.findMany.mock.calls[0]?.[0].where.OR).toEqual([
      { fullName: { contains: "Ama", mode: "insensitive" } },
      { phone: { contains: "Ama" } },
    ]);
  });

  test("strips punctuation from a phone search so 024 123 4567 matches E.164", async () => {
    const prisma = makePrisma();

    await getUsers(prisma, `?search=${encodeURIComponent("024 123-4567")}`);

    expect(prisma.profile.findMany.mock.calls[0]?.[0].where.OR[1]).toEqual({
      phone: { contains: "0241234567" },
    });
  });

  test("role and search compose", async () => {
    const prisma = makePrisma();

    await getUsers(prisma, "?role=rider&search=Kofi");

    const where = prisma.profile.findMany.mock.calls[0]?.[0].where;
    expect(where.role).toBe("rider");
    expect(where.OR).toBeDefined();
    // The count has to see the same filter, or the pager lies.
    expect(prisma.profile.count.mock.calls[0]?.[0].where).toEqual(where);
  });

  test("a non-admin gets nothing", async () => {
    const prisma = makePrisma();

    const res = await getUsers(prisma, "", { id: "student-1", role: "student" as Role });

    expect(res.statusCode).toBe(403);
    expect(prisma.profile.findMany).not.toHaveBeenCalled();
  });
});
