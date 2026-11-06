import { describe, expect, it } from "vitest";
import { recentPickupRoutes, type RouteOrder } from "../pickupRoutes";

const quad = { id: "cp-quad", name: "Ashesi Quad" };
const gate = { id: "cp-gate", name: "Main Gate" };
const market = { id: "cp-market", name: "Night Market" };

const pickup = (over: Partial<RouteOrder>): RouteOrder => ({
  id: "o1",
  orderType: "pickup",
  createdAt: "2026-09-20T10:00:00Z",
  originCheckpoint: quad,
  checkpoint: gate,
  ...over,
});

describe("recentPickupRoutes", () => {
  it("returns nothing when there are no pickups", () => {
    expect(recentPickupRoutes([])).toEqual([]);
    expect(recentPickupRoutes([pickup({ orderType: "buy_for_me" })])).toEqual([]);
  });

  it("keeps one entry per route, newest first, and counts repeats", () => {
    const routes = recentPickupRoutes([
      pickup({ id: "a", createdAt: "2026-09-01T10:00:00Z" }),
      pickup({ id: "b", createdAt: "2026-09-20T10:00:00Z" }),
      pickup({ id: "c", createdAt: "2026-09-10T10:00:00Z", originCheckpoint: market, checkpoint: quad }),
    ]);
    expect(routes.map((r) => r.key)).toEqual(["cp-quad->cp-gate", "cp-market->cp-quad"]);
    expect(routes[0]).toMatchObject({ originName: "Ashesi Quad", destinationName: "Main Gate", timesUsed: 2 });
    // The newest use of the route, not the oldest.
    expect(routes[0]!.lastUsedAt).toBe("2026-09-20T10:00:00.000Z");
  });

  it("treats a reversed route as its own route", () => {
    const routes = recentPickupRoutes([
      pickup({ id: "a", originCheckpoint: quad, checkpoint: gate }),
      pickup({ id: "b", originCheckpoint: gate, checkpoint: quad }),
    ]);
    expect(routes).toHaveLength(2);
  });

  it("skips orders missing a checkpoint, or sent to the same place", () => {
    expect(
      recentPickupRoutes([
        pickup({ id: "a", originCheckpoint: null }),
        pickup({ id: "b", checkpoint: null }),
        pickup({ id: "c", originCheckpoint: quad, checkpoint: quad }),
      ]),
    ).toEqual([]);
  });

  it("caps the list", () => {
    const routes = recentPickupRoutes(
      [
        pickup({ id: "a", originCheckpoint: quad, checkpoint: gate }),
        pickup({ id: "b", originCheckpoint: gate, checkpoint: market }),
        pickup({ id: "c", originCheckpoint: market, checkpoint: quad }),
        pickup({ id: "d", originCheckpoint: quad, checkpoint: market }),
      ],
      3,
    );
    expect(routes).toHaveLength(3);
  });
});
