/**
 * In-process smoke tests — no live Neon required. CI runs these as the
 * integration job (checklist M10 / H8).
 */
import { describe, expect, it } from "vitest";
import { registerSchema } from "@wave/shared";
import { parseCorsOrigins } from "../config/cors";
import { testEnv } from "../test/harness";

describe("API smoke integration", () => {
  it("rejects production boot without CORS_ORIGINS", () => {
    expect(() => parseCorsOrigins({ ...testEnv(), NODE_ENV: "production", CORS_ORIGINS: undefined })).toThrow(
      /CORS_ORIGINS is required/i,
    );
  });

  it("parses comma-separated CORS origins", () => {
    const origins = parseCorsOrigins({
      ...testEnv(),
      CORS_ORIGINS: "https://admin.example.com, https://app.example.com",
    });
    expect(origins).toEqual(["https://admin.example.com", "https://app.example.com"]);
  });

  it("rejects admin self-registration at the schema layer", () => {
    const parsed = registerSchema.safeParse({
      fullName: "Bad Actor",
      phone: "+233241234567",
      password: "password123",
      role: "admin",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts optional student email on registration schema", () => {
    const parsed = registerSchema.safeParse({
      fullName: "Ama Owusu",
      phone: "+233241234567",
      password: "password123",
      role: "student",
      email: "ama@ashesi.edu.gh",
    });
    expect(parsed.success).toBe(true);
  });

  it("test harness supplies a valid Paystack secret key prefix", () => {
    expect(testEnv().PAYSTACK_SECRET_KEY.startsWith("sk_")).toBe(true);
  });
});
