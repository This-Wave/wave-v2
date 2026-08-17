import { describe, expect, test } from "vitest";
import { parseCorsOrigins } from "../cors";
import { testEnv } from "../../test/harness";

describe("parseCorsOrigins", () => {
  test("development without CORS_ORIGINS allows all origins", () => {
    expect(parseCorsOrigins(testEnv({ NODE_ENV: "development" }))).toBe(true);
  });

  test("production without CORS_ORIGINS throws", () => {
    expect(() => parseCorsOrigins(testEnv({ NODE_ENV: "production" }))).toThrow(/CORS_ORIGINS/);
  });

  test("production parses comma-separated allowlist", () => {
    expect(
      parseCorsOrigins(
        testEnv({
          NODE_ENV: "production",
          CORS_ORIGINS: "https://admin.example.com, https://app.example.com ",
        }),
      ),
    ).toEqual(["https://admin.example.com", "https://app.example.com"]);
  });
});
