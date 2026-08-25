import { describe, expect, it } from "vitest";
import { registerSchema, completeProfileSchema } from "@wave/shared";

describe("self-serve auth schemas", () => {
  it("rejects admin at registration", () => {
    const parsed = registerSchema.safeParse({
      fullName: "Bad Actor",
      phone: "+233241234567",
      password: "password123",
      role: "admin",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects admin when completing a profile", () => {
    const parsed = completeProfileSchema.safeParse({
      fullName: "Bad Actor",
      role: "admin",
    });
    expect(parsed.success).toBe(false);
  });
});
