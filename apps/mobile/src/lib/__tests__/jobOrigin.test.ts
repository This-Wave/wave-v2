import { describe, expect, it } from "vitest";
import { jobOrigin, jobPay } from "../jobOrigin";

const base = { shop: null, originCheckpoint: null, suggestion: null, deliveryFee: "20.00", estimatedEarning: undefined };

describe("jobOrigin", () => {
  it("names a package pickup by what it is and starts it at its checkpoint", () => {
    const o = jobOrigin({ ...base, orderType: "pickup", originCheckpoint: { name: "Main Gate" } } as never);
    expect(o).toMatchObject({ title: "Package pickup", from: "Main Gate" });
  });

  it("starts a suggested-shop run at the suggested shop, not 'Shop'", () => {
    const o = jobOrigin({ ...base, orderType: "shop_pickup", suggestion: { name: "Kofi Broke Man", locationText: "By the gate" } } as never);
    expect(o).toMatchObject({ title: "Kofi Broke Man", from: "By the gate" });
  });

  it("keeps the Wave shop for Buy for me", () => {
    const o = jobOrigin({ ...base, orderType: "buy_for_me", shop: { name: "Mama Put", locationText: "Town", logoUrl: "x" } } as never);
    expect(o).toMatchObject({ title: "Mama Put", from: "Town", logoUrl: "x" });
  });
});

describe("jobPay", () => {
  it("shows the rider's share when the server quotes one", () => {
    expect(jobPay({ ...base, orderType: "pickup", estimatedEarning: "16.00" } as never)).toEqual({ amount: 16, isEarning: true });
  });

  it("falls back to the fee and says so", () => {
    expect(jobPay({ ...base, orderType: "pickup" } as never)).toEqual({ amount: 20, isEarning: false });
  });
});
