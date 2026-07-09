import { describe, expect, test } from "vitest";
import { generateDeliveryPin, verifyDeliveryPin } from "../pin";

describe("PIN Verification", () => {
  test("correct PIN returns true", async () => {
    const { pin, hash } = await generateDeliveryPin();
    expect(await verifyDeliveryPin(pin, hash)).toBe(true);
  });

  test("wrong PIN returns false", async () => {
    const { hash } = await generateDeliveryPin();
    expect(await verifyDeliveryPin("000000", hash)).toBe(false);
  });
});
