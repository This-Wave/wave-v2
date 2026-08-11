import { describe, expect, test } from "vitest";
import { decryptDeliveryPin, encryptDeliveryPin } from "../pinCrypto";

describe("pinCrypto", () => {
  test("round-trips a six-digit PIN", () => {
    const blob = encryptDeliveryPin("482915", "secret-a");
    expect(blob).not.toContain("482915");
    expect(decryptDeliveryPin(blob, "secret-a")).toBe("482915");
  });

  test("rejects the wrong secret", () => {
    const blob = encryptDeliveryPin("482915", "secret-a");
    expect(() => decryptDeliveryPin(blob, "secret-b")).toThrow();
  });
});
