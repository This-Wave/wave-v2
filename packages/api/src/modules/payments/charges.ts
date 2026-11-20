import type { Env } from "../../config/env";
import { fetchPaystackTransaction } from "./paystack";
import { paystackMatchesGhs } from "./amounts";
import { isMoolreReference, moolreAmountMatches, moolreCollectionStatus } from "./moolre";

/**
 * One question asked of whichever provider took a charge: did this reference
 * take the money, and was it the right amount?
 *
 * The reference itself says which provider to ask (a Moolre one starts
 * `WAVEM`), so an order paid by Paystack before the switch is still checked
 * against Paystack, and the verify poll, initiate guard and abandoned-checkout
 * sweep need no per-provider branches of their own.
 *
 * Throws when the provider cannot be reached. Callers treat that as "we know
 * nothing", which is never the same as "not paid".
 */
export type ChargeState = "paid" | "failed" | "pending" | "not_found";

export interface ChargeLookup {
  provider: "paystack" | "moolre";
  state: ChargeState;
  /** Only meaningful when `state` is "paid". */
  amountMatches: boolean;
  /** The number that paid, when the provider says (Moolre). */
  payer?: string;
}

export async function lookupCharge(env: Env, reference: string, expectedGhs: number): Promise<ChargeLookup> {
  if (isMoolreReference(reference)) {
    const tx = await moolreCollectionStatus(env, reference);
    return {
      provider: "moolre",
      state: tx.state,
      amountMatches: moolreAmountMatches(tx.amount, expectedGhs),
      payer: tx.payer,
    };
  }

  const tx = await fetchPaystackTransaction(env.PAYSTACK_SECRET_KEY, reference);
  if (!tx) return { provider: "paystack", state: "not_found", amountMatches: false };
  const state: ChargeState =
    tx.status === "success" ? "paid"
    : tx.status === "failed" || tx.status === "abandoned" || tx.status === "reversed" ? "failed"
    : "pending";
  return { provider: "paystack", state, amountMatches: paystackMatchesGhs(tx, expectedGhs) };
}
