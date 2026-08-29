import { describe, expect, test } from "vitest";
import { ORDER_STATUSES } from "@wave/shared";
import { ORDER_TRANSITIONS, allowedPredecessors, canTransition } from "../transitions";

/**
 * The order lifecycle as one table (review 09-architecture, C2).
 *
 * These are mostly structural assertions: the table is only useful if it covers
 * every status and if terminal states really are terminal. A missing key would
 * make `canTransition` silently answer false for everything from that state,
 * which reads as "correctly locked down" and is actually "route broken".
 */
describe("ORDER_TRANSITIONS — table shape", () => {
  test("covers every status in the enum", () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
  });

  test("every target is itself a real status", () => {
    for (const [from, targets] of Object.entries(ORDER_TRANSITIONS)) {
      for (const to of targets) {
        expect(ORDER_STATUSES, `${from} → ${to}`).toContain(to);
      }
    }
  });

  test("no status transitions to itself — a no-op is not a transition", () => {
    for (const [from, targets] of Object.entries(ORDER_TRANSITIONS)) {
      expect(targets, from).not.toContain(from);
    }
  });
});

describe("terminal states", () => {
  test("cancelled is terminal", () => {
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
  });

  test("refunded is terminal", () => {
    expect(ORDER_TRANSITIONS.refunded).toEqual([]);
  });

  test("delivered leads only to refunded", () => {
    // An admin can refund after a handover; nothing else may follow.
    expect(ORDER_TRANSITIONS.delivered).toEqual(["refunded"]);
  });

  test.each(["delivered", "cancelled", "refunded"] as const)(
    "%s cannot go back into the active flow",
    (from) => {
      for (const to of ["confirmed", "rider_assigned", "en_route", "at_checkpoint"] as const) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(false);
      }
    },
  );
});

describe("the happy path is walkable end to end", () => {
  test("pending → … → delivered", () => {
    const path = [
      "pending",
      "payment_pending",
      "confirmed",
      "rider_assigned",
      "en_route",
      "at_checkpoint",
      "delivered",
    ] as const;

    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!), `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });

  test("an order can be cancelled at any point before delivery", () => {
    for (const from of [
      "pending",
      "payment_pending",
      "confirmed",
      "rider_assigned",
      "en_route",
      "at_checkpoint",
    ] as const) {
      expect(canTransition(from, "cancelled"), from).toBe(true);
    }
  });

  test("a paid order can be refunded at any point up to and including delivery", () => {
    for (const from of [
      "confirmed",
      "rider_assigned",
      "en_route",
      "at_checkpoint",
      "delivered",
    ] as const) {
      expect(canTransition(from, "refunded"), from).toBe(true);
    }
  });

  test("an unpaid order cannot be refunded — there is no money to return", () => {
    expect(canTransition("pending", "refunded")).toBe(false);
    expect(canTransition("payment_pending", "refunded")).toBe(false);
  });
});

describe("the jumps that were actually reachable before this existed", () => {
  test("a delivered order cannot be pushed back to en_route", () => {
    // The rider status route's predicate was `{ id, riderId }`, and a delivered
    // order still has a riderId.
    expect(canTransition("delivered", "en_route")).toBe(false);
  });

  test("a refunded order cannot be marked delivered", () => {
    expect(canTransition("refunded", "delivered")).toBe(false);
  });

  test("a delivered order cannot be delivered again", () => {
    // Each delivery increments the loyalty counter toward a 20% discount.
    expect(allowedPredecessors("delivered")).not.toContain("cancelled");
    expect(canTransition("delivered", "delivered")).toBe(false);
  });

  test("a rider cannot skip straight from assigned to at_checkpoint", () => {
    expect(canTransition("rider_assigned", "at_checkpoint")).toBe(false);
  });
});

describe("allowedPredecessors", () => {
  test("lists the states from which a target is reachable", () => {
    expect(allowedPredecessors("at_checkpoint")).toContain("en_route");
  });

  test("includes the target itself, so a retry is a no-op not a 409", () => {
    // A dropped response is indistinguishable from a rejected request on a
    // campus network, and the client will retry.
    for (const status of ORDER_STATUSES) {
      expect(allowedPredecessors(status), status).toContain(status);
    }
  });

  test("never lists a terminal state as a predecessor of an active one", () => {
    for (const to of ["rider_assigned", "en_route", "at_checkpoint"] as const) {
      const from = allowedPredecessors(to);
      expect(from).not.toContain("cancelled");
      expect(from).not.toContain("refunded");
      expect(from).not.toContain("delivered");
    }
  });

  test("returns something usable for every status", () => {
    for (const status of ORDER_STATUSES) {
      expect(allowedPredecessors(status).length, status).toBeGreaterThan(0);
    }
  });
});
