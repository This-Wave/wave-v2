import { describe, expect, test, vi } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import type { Role } from "../../../plugins/auth";

import { riderRoutes } from "../routes";
import { buildTestApp } from "../../../test/harness";

/**
 * The rider's online/offline toggle.
 *
 * This route used to write `isActive`, which is the account **ban** flag that
 * `plugins/auth.ts` authenticates against — so a rider tapping "Offline" got a
 * 403 on their very next request and could not tap it back on. Only an admin
 * could, from a screen that calls the same flag "Deactivated". Two meanings,
 * one column; the fix is two columns.
 */
const RIDER = { id: "rider-1", role: "rider" as Role };

function makePrisma() {
  return {
    profile: {
      update: vi.fn().mockResolvedValue({ id: "rider-1", isActive: true, isAvailable: false }),
    },
  };
}

async function setAvailability(
  prisma: ReturnType<typeof makePrisma>,
  payload: Record<string, unknown>,
  user = RIDER,
): Promise<LightMyRequestResponse> {
  const app = await buildTestApp(riderRoutes, { prisma, user });
  const res = await app.inject({ method: "PATCH", url: "/availability", payload });
  await app.close();
  return res;
}

describe("PATCH /riders/availability", () => {
  test("going offline writes isAvailable and never touches the ban flag", async () => {
    const prisma = makePrisma();

    const res = await setAvailability(prisma, { isAvailable: false });

    expect(res.statusCode).toBe(200);
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: "rider-1" },
      data: { isAvailable: false },
    });
    // The regression this whole file exists for.
    expect(prisma.profile.update.mock.calls[0]?.[0].data).not.toHaveProperty("isActive");
  });

  test("coming back online writes isAvailable true", async () => {
    const prisma = makePrisma();

    await setAvailability(prisma, { isAvailable: true });

    expect(prisma.profile.update.mock.calls[0]?.[0].data).toEqual({ isAvailable: true });
  });

  test("rejects the old isActive payload rather than silently ignoring it", async () => {
    // An old client sending the previous shape must fail loudly. Accepting it
    // and writing nothing would look like a working toggle that does nothing.
    const prisma = makePrisma();

    const res = await setAvailability(prisma, { isActive: false });

    expect(res.statusCode).toBe(400);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  test("only a rider may set availability", async () => {
    const prisma = makePrisma();

    const res = await setAvailability(prisma, { isAvailable: false }, {
      id: "student-1",
      role: "student" as Role,
    });

    expect(res.statusCode).toBe(403);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });
});
