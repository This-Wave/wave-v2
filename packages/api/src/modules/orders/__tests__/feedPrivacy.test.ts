import { describe, expect, it, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { orderRoutes } from "../routes";
import { clientSafeOrder, feedOrder } from "../select";

/**
 * Guards the boundary between "a rider browsing jobs" and "a rider who has
 * taken one".
 *
 * The rider feed polls every 10 seconds. When it shared `clientSafeOrder` with
 * every other order route it handed every verified rider the full name, phone
 * number and student ID of every student with an unclaimed order — without the
 * rider ever accepting anything.
 *
 * These tests assert the *shape of the select passed to Prisma*, not the shape
 * of a stubbed response. That is deliberate: the harness stubs Prisma, so a
 * test that only inspected the returned rows would pass no matter what the
 * route asked the database for. Asserting the select is the one thing a stub
 * can genuinely prove here.
 */
describe("rider feed privacy", () => {
  function harness(findMany: ReturnType<typeof vi.fn>) {
    return buildTestApp(orderRoutes, {
      prisma: {
        order: { findMany },
        profile: {
          findUnique: vi.fn().mockResolvedValue({ isVerified: true, universityId: "uni-1" }),
        },
      },
      user: { id: "rider-1", role: "rider" },
    });
  }

  /** The `select` the route actually handed Prisma on its first call. */
  function selectFrom(findMany: ReturnType<typeof vi.fn>): Record<string, unknown> {
    const call = findMany.mock.calls[0];
    expect(call).toBeDefined();
    return (call![0] as { select: Record<string, unknown> }).select;
  }

  it("does not ask the database for the student on unclaimed orders", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const app = await harness(findMany);

    await app.inject({ method: "GET", url: "/available" });

    const select = selectFrom(findMany);
    expect(select).not.toHaveProperty("student");
    expect(select).not.toHaveProperty("rider");
    await app.close();
  });

  it("still gives the rider what they need to choose a job", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const app = await harness(findMany);

    await app.inject({ method: "GET", url: "/available" });

    const select = selectFrom(findMany);
    expect(select).toHaveProperty("shop");
    expect(select).toHaveProperty("checkpoint");
    expect(select.deliveryFee).toBe(true);
    await app.close();
  });

  it("scopes unclaimed orders to the rider's campus", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const app = await harness(findMany);

    await app.inject({ method: "GET", url: "/available" });

    const where = (findMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ universityId: "uni-1", status: "confirmed", riderId: null });
    await app.close();
  });

  it("uses feedOrder, not clientSafeOrder", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const app = await harness(findMany);

    await app.inject({ method: "GET", url: "/available" });

    expect(selectFrom(findMany)).toBe(feedOrder);
    await app.close();
  });

  it("a rider's own deliveries DO carry the student — they have to coordinate", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const app = await harness(findMany);

    await app.inject({ method: "GET", url: "/my-deliveries" });

    expect(selectFrom(findMany)).toBe(clientSafeOrder);
    expect(clientSafeOrder).toHaveProperty("student");
    await app.close();
  });

  it("neither select ever exposes the delivery PIN hash or ciphertext", () => {
    expect(feedOrder).not.toHaveProperty("deliveryPinHash");
    expect(feedOrder).not.toHaveProperty("deliveryPinCiphertext");
    expect(clientSafeOrder).not.toHaveProperty("deliveryPinHash");
    expect(clientSafeOrder).not.toHaveProperty("deliveryPinCiphertext");
  });
});
