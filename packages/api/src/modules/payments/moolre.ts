import axios from "axios";
import crypto from "node:crypto";
import type { Env } from "../../config/env";

/**
 * Moolre: Wave's Mobile Money provider (since 2026-11-20). Cards stay on Paystack.
 *
 * Docs: https://docs.moolre.com/ai/index.html?environment=live
 *
 * Things that differ from Paystack and are easy to get wrong:
 *
 * - **Amounts are cedis as a string** ("20.00"), never pesewas.
 * - **HTTP 200 even on failure.** Every answer is read from `code` and, for
 *   status lookups, `data.txstatus` (0 pending, 1 success, 2 failed). `status`
 *   arrives as a number in some responses and a string in others.
 * - **Pending is not failed.** Codes like TP18 ("network timeout, the prompt may
 *   still have been sent") mean "unknown". Never resubmit with a new reference
 *   after one of those; ask for the status by `externalref` instead.
 * - **No refund endpoint.** A refund is a payout (transfer) to the payer's
 *   number, signed with the private key.
 */

export type MoolreChannel = "MTN" | "TELECEL" | "AT";
export const MOOLRE_CHANNELS: readonly MoolreChannel[] = ["MTN", "TELECEL", "AT"];

/** Reference prefixes. The prefix is how the rest of the API tells a Moolre charge from a Paystack one. */
export const MOOLRE_DELIVERY_PREFIX = "WAVEM-";
export const MOOLRE_GOODS_PREFIX = "WAVEMGOODS-";

export function isMoolreReference(reference: string | null | undefined): boolean {
  return !!reference && (reference.startsWith(MOOLRE_DELIVERY_PREFIX) || reference.startsWith(MOOLRE_GOODS_PREFIX));
}

const REF_PATTERN = /^WAVEM(?:GOODS)?-(.+)-(\d{10,})$/;

/** The order id embedded in a Moolre reference (`WAVEM-<orderId>-<ms>`), or null. */
export function orderIdFromMoolreReference(reference: string): string | null {
  return REF_PATTERN.exec(reference)?.[1] ?? null;
}

/** When the reference was minted, from its millisecond suffix. */
export function mintedAtFromMoolreReference(reference: string): Date | null {
  const ms = REF_PATTERN.exec(reference)?.[2];
  return ms ? new Date(Number(ms)) : null;
}

export function isMoolreConfigured(env: Env): boolean {
  return !!(env.MOOLRE_API_USER && env.MOOLRE_PUBLIC_KEY && env.MOOLRE_ACCOUNT_NUMBER);
}

/**
 * Normalises a Ghana mobile number to the local `0XXXXXXXXX` form Moolre wants.
 * Accepts `024…`, `24…`, `233…` and `+233…`, with spaces or dashes. Null when it
 * is not a 10-digit Ghana mobile number.
 */
export function normaliseGhanaMobile(input: string): string | null {
  let digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("233")) digits = digits.slice(3);
  if (digits.length === 9) digits = `0${digits}`;
  if (!/^0[2-5]\d{8}$/.test(digits)) return null;
  return digits;
}

const NETWORK_PREFIXES: Record<MoolreChannel, string[]> = {
  MTN: ["24", "25", "53", "54", "55", "59"],
  TELECEL: ["20", "50"],
  AT: ["26", "27", "56", "57"],
};

/**
 * A best guess at the network from the number's prefix. Only a default for the
 * picker: numbers can be ported between networks, so the student's choice wins.
 */
export function guessNetwork(localNumber: string): MoolreChannel | null {
  const prefix = localNumber.slice(1, 3);
  for (const channel of MOOLRE_CHANNELS) {
    if (NETWORK_PREFIXES[channel].includes(prefix)) return channel;
  }
  return null;
}

/** Cedis to the two-decimal string Moolre expects. */
export function moolreAmount(amountGhs: number): string {
  return (Math.round(amountGhs * 100) / 100).toFixed(2);
}

/** True when a Moolre amount string is exactly `expectedGhs`, compared in pesewas. */
export function moolreAmountMatches(amount: string | number | null | undefined, expectedGhs: number): boolean {
  if (amount === null || amount === undefined || amount === "") return false;
  const got = Math.round(Number(amount) * 100);
  return Number.isFinite(got) && got === Math.round(expectedGhs * 100);
}

interface MoolreEnvelope<T = unknown> {
  status?: number | string;
  code?: string;
  message?: string | string[] | null;
  data?: T;
}

export class MoolreNotConfiguredError extends Error {
  constructor() {
    super("Mobile Money is not set up yet. Please pay by card or try again later.");
  }
}

function baseUrl(env: Env): string {
  return (env.MOOLRE_BASE_URL ?? "https://api.moolre.com").replace(/\/$/, "");
}

function publicHeaders(env: Env, idempotencyKey?: string): Record<string, string> {
  if (!isMoolreConfigured(env)) throw new MoolreNotConfiguredError();
  return {
    "Content-Type": "application/json",
    "X-API-USER": env.MOOLRE_API_USER!,
    "X-API-PUBKEY": env.MOOLRE_PUBLIC_KEY!,
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  };
}

function privateHeaders(env: Env, idempotencyKey?: string): Record<string, string> {
  if (!isMoolreConfigured(env) || !env.MOOLRE_PRIVATE_KEY) throw new MoolreNotConfiguredError();
  return {
    "Content-Type": "application/json",
    "X-API-USER": env.MOOLRE_API_USER!,
    "X-API-KEY": env.MOOLRE_PRIVATE_KEY,
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  };
}

function messageOf(envelope: MoolreEnvelope): string | undefined {
  const m = envelope.message;
  if (Array.isArray(m)) return m.filter(Boolean).join(" ") || undefined;
  return m ?? undefined;
}

async function post<T>(env: Env, path: string, body: unknown, headers: Record<string, string>) {
  const response = await axios.post<MoolreEnvelope<T>>(`${baseUrl(env)}${path}`, body, {
    headers,
    timeout: 15_000, // inside Moolre's 20 s webhook deadline
  });
  return response.data ?? {};
}

/**
 * Codes that mean "we do not know yet". The request may well have reached the
 * network, so the only safe follow-up is a status lookup by `externalref`.
 */
const UNKNOWN_CODES = new Set([
  "PY01", "PY02", "TR01", "TR02", "TP11", "TP18", "APY10", "APY16", "ASL06", "IS30", "SYS500",
]);

export type CollectOutcome =
  | { kind: "prompt_sent"; transactionId?: string }
  | { kind: "otp_required" }
  | { kind: "otp_verified" }
  | { kind: "otp_wrong"; message: string }
  | { kind: "duplicate" }
  | { kind: "unknown"; code: string }
  | { kind: "rejected"; code: string; message: string };

export interface CollectParams {
  reference: string;
  amountGhs: number;
  payer: string;
  channel: MoolreChannel;
  otpCode?: string;
  /**
   * One per distinct step (start, each OTP code, the send after OTP). Moolre
   * replays the stored answer for a repeated key, so reusing one across steps
   * would hand back the earlier step's answer instead of doing the next.
   */
  idempotencyKey: string;
}

/**
 * Sends the MoMo approval prompt to the payer's phone.
 *
 * Some numbers must verify an SMS code first (TP14/TP19). The flow is then:
 * resend with `otpcode` and the SAME reference (TP17 verified), then send again
 * without it to fire the prompt (TR099).
 */
export async function moolreCollect(env: Env, params: CollectParams): Promise<CollectOutcome> {
  const body = {
    type: 1,
    channel: params.channel,
    currency: "GHS",
    payer: params.payer,
    amount: moolreAmount(params.amountGhs),
    externalref: params.reference,
    reference: "Wave order",
    accountnumber: env.MOOLRE_ACCOUNT_NUMBER,
    ...(params.otpCode ? { otpcode: params.otpCode } : {}),
  };
  const env1 = await post<string>(env, "/open/transact/payment", body, publicHeaders(env, params.idempotencyKey));
  const code = env1.code ?? "";
  if (code === "TR099") {
    return { kind: "prompt_sent", transactionId: typeof env1.data === "string" ? env1.data : undefined };
  }
  if (code === "TP14" || code === "TP19") return { kind: "otp_required" };
  if (code === "TP17") return { kind: "otp_verified" };
  if (code === "TP15") return { kind: "otp_wrong", message: messageOf(env1) ?? "That code is not right." };
  if (code === "TP13") return { kind: "duplicate" };
  if (UNKNOWN_CODES.has(code)) return { kind: "unknown", code };
  return { kind: "rejected", code, message: messageOf(env1) ?? "Mobile Money could not start the payment." };
}

export type MoolreTxState = "paid" | "failed" | "pending" | "not_found";

export interface MoolreTransaction {
  state: MoolreTxState;
  amount?: string;
  payer?: string;
  externalref?: string;
  transactionId?: string;
}

function stateOf(envelope: MoolreEnvelope<Record<string, unknown>>): MoolreTxState {
  const code = envelope.code ?? "";
  if (code === "SS07") return "not_found";
  const tx = Number(envelope.data?.txstatus);
  if (tx === 1) return "paid";
  if (tx === 2) return "failed";
  if (tx === 0) return "pending";
  if (code === "SS01") return "paid";
  if (code === "SS02") return "failed";
  // SS08, unknown codes, or a missing txstatus: we cannot say, so it is pending.
  return "pending";
}

/** Asks Moolre what happened to a collection, by our reference. */
export async function moolreCollectionStatus(env: Env, reference: string): Promise<MoolreTransaction> {
  const envelope = await post<Record<string, unknown>>(
    env,
    "/open/transact/status",
    { type: 1, idtype: 1, id: reference, accountnumber: env.MOOLRE_ACCOUNT_NUMBER },
    publicHeaders(env),
  );
  const d = envelope.data ?? {};
  return {
    state: stateOf(envelope),
    amount: d.amount !== undefined ? String(d.amount) : undefined,
    payer: d.payer !== undefined ? String(d.payer) : undefined,
    externalref: d.externalref !== undefined ? String(d.externalref) : undefined,
    transactionId: d.transactionid !== undefined ? String(d.transactionid) : undefined,
  };
}

/** Payout codes that mean the money actually left. Any other status-1 answer is unfinished. */
const PAYOUT_DONE_CODES = new Set(["TR08", "OBGH01", "OTGH01", "OBNG01", "GHQ03", "OM03"]);

export type PayoutState = "paid" | "pending" | "failed";

export interface PayoutResult {
  state: PayoutState;
  reference: string;
  code?: string;
  message?: string;
}

async function payoutStatus(env: Env, reference: string): Promise<MoolreTxState> {
  const envelope = await post<Record<string, unknown>>(
    env,
    "/open/transact/status",
    { type: 1, idtype: 1, id: reference, accountnumber: env.MOOLRE_ACCOUNT_NUMBER },
    privateHeaders(env),
  );
  return stateOf(envelope);
}

/**
 * Sends `amountGhs` to a MoMo number: how Wave refunds a Moolre payment.
 *
 * **Never pays twice.** The payout reference is derived from the charge
 * (`RF-<charge>`), so a retry finds the earlier payout and reports on it rather
 * than sending more money. Only when an earlier attempt definitely failed is a
 * new one made, as `RF-<charge>-2`, `-3` and so on.
 */
export async function moolrePayout(
  env: Env,
  params: { chargeReference: string; amountGhs: number; receiver: string; channel: MoolreChannel },
): Promise<PayoutResult> {
  const base = `RF-${params.chargeReference}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const reference = attempt === 1 ? base : `${base}-${attempt}`;
    const existing = await payoutStatus(env, reference);
    if (existing === "paid") return { state: "paid", reference };
    if (existing === "pending") return { state: "pending", reference };
    if (existing === "failed") continue;

    const envelope = await post<Record<string, unknown>>(
      env,
      "/open/transact/transfer",
      {
        type: 1,
        channel: params.channel,
        currency: "GHS",
        amount: moolreAmount(params.amountGhs),
        receiver: params.receiver,
        externalref: reference,
        reference: "Wave refund",
        sendername: "Ride the Wave",
        accountnumber: env.MOOLRE_ACCOUNT_NUMBER,
      },
      privateHeaders(env, reference),
    );
    const code = envelope.code ?? "";
    const ok = Number(envelope.status) === 1;
    if (ok && PAYOUT_DONE_CODES.has(code)) return { state: "paid", reference, code };
    if (ok || UNKNOWN_CODES.has(code)) return { state: "pending", reference, code };
    return { state: "failed", reference, code, message: messageOf(envelope) };
  }
  return { state: "failed", reference: base, message: "Five payout attempts failed for this payment." };
}

/** How old a webhook signature may be before it is refused as a replay. */
export const MOOLRE_SIGNATURE_TOLERANCE_S = 300;

/**
 * Checks `X-Moolre-Signature: t=<unix>,v1=<hex>`, where v1 is an HMAC-SHA256 of
 * `"<t>.<raw body>"` keyed with the wallet's callback secret.
 */
export function verifyMoolreSignature(
  secret: string,
  rawBody: string,
  header: string | undefined,
  nowS: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(nowS - t) > MOOLRE_SIGNATURE_TOLERANCE_S) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
