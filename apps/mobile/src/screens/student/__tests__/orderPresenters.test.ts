import { describe, expect, test } from "vitest";
import { orderSteps, shortOrderRef, statusPill } from "../orderPresenters";
import type { Order } from "../../../types";

const base = {
  id: "0f3a21c0-1111-4111-8111-7f3a21c0aa12",
  status: "en_route",
  orderType: "buy_for_me",
  shop: { name: "Fresh Mart" },
  checkpoint: { name: "Ashesi Quad" },
  rider: null,
} as unknown as Order;

describe("Wave-packed orders are told in Wave's words", () => {
  test("status pills", () => {
    expect(statusPill("rider_assigned", true).label).toBe("Collecting");
    expect(statusPill("en_route", true).label).toBe("Packing");
    expect(statusPill("at_checkpoint", true).label).toBe("Ready for you");
    expect(statusPill("en_route").label).toBe("On the way");
  });

  test("steps never mention a runner or a company", () => {
    const steps = orderSteps({ ...base, companyId: "co-1" } as Order);
    const text = steps.map((s) => s.label).join(" | ");
    expect(text).toBe(
      "Order confirmed | Collecting from Fresh Mart | Packing at Wave | Ready at Ashesi Quad | Delivered",
    );
    expect(text).not.toMatch(/runner|rider|company/i);
  });

  test("one order number everywhere", () => {
    expect(shortOrderRef(base.id)).toBe("#WV-C0AA12");
  });
});
