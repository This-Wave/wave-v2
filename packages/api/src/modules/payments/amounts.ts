import type { PaystackTransaction } from "./paystack";

export function ghsToPesewas(amountGhs: number): number {
  return Math.round(amountGhs * 100);
}

/** Returns false when Paystack amount/currency does not match what Wave expects. */
export function paystackMatchesGhs(
  transaction: Pick<PaystackTransaction, "amount" | "currency">,
  expectedGhs: number,
): boolean {
  return transaction.currency === "GHS" && transaction.amount === ghsToPesewas(expectedGhs);
}
