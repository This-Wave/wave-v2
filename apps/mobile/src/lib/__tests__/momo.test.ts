import { describe, expect, test } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { guessMomoNetwork, maskMomoNumber, pendingPromptReference } from "../momo";

describe("guessMomoNetwork", () => {
  test.each([
    ["241234521", "MTN"],
    ["0551234521", "MTN"],
    ["501234521", "TELECEL"],
    ["271234521", "AT"],
    ["301234521", null],
  ])("%s → %s", (digits, net) => expect(guessMomoNetwork(digits)).toBe(net));
});

describe("maskMomoNumber", () => {
  test("shows the prefix and last four only", () => {
    expect(maskMomoNumber("0241234521")).toBe("024 ••• 4521");
    expect(maskMomoNumber("241234521")).toBe("024 ••• 4521");
    expect(maskMomoNumber("+233241234521")).toBe("024 ••• 4521");
  });
});

describe("pendingPromptReference", () => {
  const err = (status: number, data: unknown) =>
    new AxiosError("x", "ERR", undefined, undefined, {
      status,
      data,
      statusText: "",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

  test("reads the live prompt's reference off a 409", () => {
    expect(pendingPromptReference(err(409, { code: "prompt_pending", reference: "WAVEM-o-1" }))).toBe("WAVEM-o-1");
  });
  test("ignores every other error", () => {
    expect(pendingPromptReference(err(409, { error: "already paid" }))).toBeNull();
    expect(pendingPromptReference(err(502, { code: "prompt_pending", reference: "r" }))).toBeNull();
    expect(pendingPromptReference(new Error("x"))).toBeNull();
  });
});
