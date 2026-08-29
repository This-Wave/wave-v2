import { describe, expect, test } from "vitest";
import { apiErrorMessage } from "../apiError";

/**
 * Every screen's failure copy now routes through this (review 08-mobile, H4).
 * The cases that matter are the malformed ones: if this throws or returns
 * something unrenderable, a failed mutation takes the screen down instead of
 * showing a toast — which is worse than the silent failure it replaced.
 */
const FALLBACK = "Could not accept this order.";

describe("apiErrorMessage", () => {
  test("returns the API's own message when there is one", () => {
    // The whole point: "already accepted by another rider" tells a rider to go
    // back to the feed; a generic message leaves them tapping again.
    const err = {
      response: { data: { error: "This order has already been accepted by another rider" } },
    };

    expect(apiErrorMessage(err, FALLBACK)).toBe(
      "This order has already been accepted by another rider",
    );
  });

  test.each([
    ["a network error with no response", new Error("Network Error")],
    ["null", null],
    ["undefined", undefined],
    ["a string", "boom"],
    ["an empty object", {}],
    ["a response with no data", { response: {} }],
    ["data with no error field", { response: { data: {} } }],
  ])("falls back for %s", (_label, err) => {
    expect(apiErrorMessage(err, FALLBACK)).toBe(FALLBACK);
  });

  test.each([
    ["an empty string", ""],
    ["whitespace only", "   "],
  ])("falls back when the error is %s — an empty toast is useless", (_label, error) => {
    expect(apiErrorMessage({ response: { data: { error } } }, FALLBACK)).toBe(FALLBACK);
  });

  test.each([
    ["an object", { code: "P2025" }],
    ["an array", ["a", "b"]],
    ["a number", 500],
  ])("falls back when error is %s rather than rendering [object Object]", (_label, error) => {
    expect(apiErrorMessage({ response: { data: { error } } }, FALLBACK)).toBe(FALLBACK);
  });

  test("never throws, whatever it is handed", () => {
    const nasty = Object.create(null) as unknown;
    expect(() => apiErrorMessage(nasty, FALLBACK)).not.toThrow();
  });

  test("always returns a non-empty string", () => {
    for (const err of [null, {}, new Error("x"), { response: { data: { error: "" } } }]) {
      expect(apiErrorMessage(err, FALLBACK).length).toBeGreaterThan(0);
    }
  });
});
