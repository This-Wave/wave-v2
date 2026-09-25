import { describe, expect, it } from "vitest";
import { STEP_RANK, stepFor } from "../deliveryStep";

describe("stepFor", () => {
  it("resumes a delivery where the server says it is", () => {
    expect(stepFor("en_route")).toBe("en_route");
    expect(stepFor("at_checkpoint")).toBe("at_checkpoint");
  });

  it("starts at collection before pickup, and while the order is loading", () => {
    expect(stepFor("rider_assigned")).toBe("at_shop");
    expect(stepFor(undefined)).toBe("at_shop");
  });

  it("ranks steps in delivery order, so local state never rewinds the server's", () => {
    expect(STEP_RANK.at_shop).toBeLessThan(STEP_RANK.en_route);
    expect(STEP_RANK.en_route).toBeLessThan(STEP_RANK.at_checkpoint);
  });
});
