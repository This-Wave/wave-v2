import crypto from "node:crypto";
import { describe, expect, test, vi, beforeEach } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("axios", () => ({ default: { post, isAxiosError: () => false } }));

import {
  guessNetwork,
  moolreAmount,
  moolreAmountMatches,
  moolreCollect,
  moolreCollectionStatus,
  moolrePayout,
  normaliseGhanaMobile,
  orderIdFromMoolreReference,
  verifyMoolreSignature,
  MoolreNotConfiguredError,
} from "../moolre";
import { testEnv } from "../../../test/harness";

const env = testEnv({
  MOOLRE_API_USER: "wave",
  MOOLRE_PUBLIC_KEY: "pub",
  MOOLRE_PRIVATE_KEY: "priv",
  MOOLRE_ACCOUNT_NUMBER: "10001",
});

const ORDER_ID = "3f2a8c1e-1111-4222-8333-944455556666";

beforeEach(() => post.mockReset());

describe("numbers and amounts", () => {
  test.each([
    ["024 123 4567", "0241234567"],
    ["+233241234567", "0241234567"],
    ["233 50 123 4567", "0501234567"],
    ["241234567", "0241234567"],
  ])("normalises %s", (input, out) => expect(normaliseGhanaMobile(input)).toBe(out));

  test("rejects what is not a Ghana mobile number", () => {
    expect(normaliseGhanaMobile("12345")).toBeNull();
    expect(normaliseGhanaMobile("0812345678")).toBeNull();
  });

  test("guesses the network from the prefix", () => {
    expect(guessNetwork("0241234567")).toBe("MTN");
    expect(guessNetwork("0501234567")).toBe("TELECEL");
    expect(guessNetwork("0271234567")).toBe("AT");
  });

  test("amounts are cedi strings, never pesewas", () => {
    expect(moolreAmount(20)).toBe("20.00");
    expect(moolreAmount(40.5)).toBe("40.50");
    expect(moolreAmountMatches("40.00", 40)).toBe(true);
    expect(moolreAmountMatches("4000", 40)).toBe(false);
    expect(moolreAmountMatches(undefined, 40)).toBe(false);
  });

  test("the order id comes back out of a reference", () => {
    expect(orderIdFromMoolreReference(`WAVEM-${ORDER_ID}-1763640000000`)).toBe(ORDER_ID);
    expect(orderIdFromMoolreReference(`WAVEMGOODS-${ORDER_ID}-1763640000000`)).toBe(ORDER_ID);
    expect(orderIdFromMoolreReference("WAVE-x-1")).toBeNull();
  });
});

describe("moolreCollect", () => {
  const params = { reference: "WAVEM-o-1763640000000", amountGhs: 40, payer: "0241234567", channel: "MTN" as const, idempotencyKey: "k" };

  test("sends cedis, the account number and the public key", async () => {
    post.mockResolvedValue({ data: { status: 1, code: "TR099", data: "tx-1" } });
    await expect(moolreCollect(env, params)).resolves.toEqual({ kind: "prompt_sent", transactionId: "tx-1" });
    const [url, body, config] = post.mock.calls[0]!;
    expect(url).toBe("https://sandbox.moolre.com/open/transact/payment");
    expect(body).toMatchObject({ type: 1, amount: "40.00", currency: "GHS", accountnumber: "10001", externalref: params.reference });
    expect(config.headers).toMatchObject({ "X-API-USER": "wave", "X-API-PUBKEY": "pub", "Idempotency-Key": "k" });
    expect(config.headers["X-API-KEY"]).toBeUndefined();
  });

  test.each([
    ["TP14", "otp_required"],
    ["TP19", "otp_required"],
    ["TP17", "otp_verified"],
    ["TP15", "otp_wrong"],
    ["TP13", "duplicate"],
    ["TP18", "unknown"],
    ["XX01", "rejected"],
  ])("code %s reads as %s", async (code, kind) => {
    post.mockResolvedValue({ data: { status: 0, code, message: "m" } });
    await expect(moolreCollect(env, params)).resolves.toMatchObject({ kind });
  });

  test("refuses to call out without keys", async () => {
    await expect(moolreCollect(testEnv(), params)).rejects.toBeInstanceOf(MoolreNotConfiguredError);
    expect(post).not.toHaveBeenCalled();
  });
});

describe("moolreCollectionStatus", () => {
  test.each([
    [{ code: "SS01", data: { txstatus: 1, amount: "40.00" } }, "paid"],
    [{ code: "SS02", data: { txstatus: 2 } }, "failed"],
    [{ code: "SS08", data: { txstatus: 0 } }, "pending"],
    [{ code: "SS07" }, "not_found"],
    [{ code: "SYS500" }, "pending"],
  ])("%j is %s", async (data, state) => {
    post.mockResolvedValue({ data });
    await expect(moolreCollectionStatus(env, "WAVEM-o-1")).resolves.toMatchObject({ state });
  });
});

describe("moolrePayout never pays twice", () => {
  const params = { chargeReference: "WAVEM-o-1", amountGhs: 40, receiver: "0241234567", channel: "MTN" as const };

  test("an earlier payout that went through is reported, not repeated", async () => {
    post.mockResolvedValueOnce({ data: { code: "SS01", data: { txstatus: 1 } } });
    await expect(moolrePayout(env, params)).resolves.toMatchObject({ state: "paid", reference: "RF-WAVEM-o-1" });
    expect(post).toHaveBeenCalledTimes(1);
  });

  test("an earlier payout still pending is not repeated", async () => {
    post.mockResolvedValueOnce({ data: { code: "SS08", data: { txstatus: 0 } } });
    await expect(moolrePayout(env, params)).resolves.toMatchObject({ state: "pending" });
    expect(post).toHaveBeenCalledTimes(1);
  });

  test("a failed earlier payout is retried on a new reference", async () => {
    post
      .mockResolvedValueOnce({ data: { code: "SS02", data: { txstatus: 2 } } })
      .mockResolvedValueOnce({ data: { code: "SS07" } })
      .mockResolvedValueOnce({ data: { status: 1, code: "OBGH01" } });
    await expect(moolrePayout(env, params)).resolves.toMatchObject({ state: "paid", reference: "RF-WAVEM-o-1-2" });
    const [url, body, config] = post.mock.calls[2]!;
    expect(url).toMatch(/\/open\/transact\/transfer$/);
    expect(body).toMatchObject({ externalref: "RF-WAVEM-o-1-2", amount: "40.00", receiver: "0241234567" });
    expect(config.headers["X-API-KEY"]).toBe("priv");
  });

  test("status 1 without a final code is pending, not done", async () => {
    post.mockResolvedValueOnce({ data: { code: "SS07" } }).mockResolvedValueOnce({ data: { status: 1, code: "TR01" } });
    await expect(moolrePayout(env, params)).resolves.toMatchObject({ state: "pending" });
  });
});

describe("verifyMoolreSignature", () => {
  const secret = "whsec";
  const body = JSON.stringify({ event: "payment.succeeded" });
  const now = 1_763_640_000;
  const sign = (t: number, b = body) =>
    `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${b}`).digest("hex")}`;

  test("accepts a fresh, correct signature", () => {
    expect(verifyMoolreSignature(secret, body, sign(now), now)).toBe(true);
  });
  test("rejects a tampered body", () => {
    expect(verifyMoolreSignature(secret, body + " ", sign(now), now)).toBe(false);
  });
  test("rejects a replay older than five minutes", () => {
    expect(verifyMoolreSignature(secret, body, sign(now - 301), now)).toBe(false);
  });
  test("rejects a missing or malformed header", () => {
    expect(verifyMoolreSignature(secret, body, undefined, now)).toBe(false);
    expect(verifyMoolreSignature(secret, body, "v1=abc", now)).toBe(false);
  });
});
