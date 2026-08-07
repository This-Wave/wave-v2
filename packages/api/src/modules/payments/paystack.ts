import axios from "axios";
import crypto from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

/** Paystack channel ids. Wave only ever offers these two in Ghana. */
export type PaystackChannel = "card" | "mobile_money";

export interface InitiatePaymentParams {
  email: string;
  amountGhs: number; // GHS — converted to pesewas before sending (GOTCHA-002)
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  /**
   * Restricts the checkout to the method the student picked, so choosing
   * "Mobile Money" doesn't land them on a card form. Omitted means offer both.
   */
  channels?: PaystackChannel[];
}

export async function initiatePaystackPayment(secretKey: string, params: InitiatePaymentParams) {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      email: params.email,
      amount: Math.round(params.amountGhs * 100), // pesewas, not cedis
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
      channels: params.channels ?? ["card", "mobile_money"],
    },
    { headers: { Authorization: `Bearer ${secretKey}` } },
  );
  return response.data.data as { authorization_url: string; access_code: string; reference: string };
}

export interface RefundParams {
  /** The `reference` the charge was initiated with (Order.paystackRef). */
  reference: string;
  /** Omit for a full refund. Partial amounts are in GHS and converted to pesewas. */
  amountGhs?: number;
  note?: string;
}

export interface PaystackRefund {
  id: number;
  /** Paystack's own refund state: "pending" | "processing" | "processed" | "failed". */
  status: string;
  amount: number; // pesewas
  currency: string;
}

/**
 * Refunds a charge. Paystack accepts the original transaction reference in the
 * `transaction` field, so no separate transaction id lookup is needed.
 *
 * A refund is queued, not instant — a successful call means Paystack accepted
 * it, and MoMo reversals in particular settle asynchronously. Throws on any
 * non-2xx, including Paystack's own "transaction has been fully refunded"
 * rejection, which is the backstop against a double refund.
 */
export async function refundPaystackPayment(
  secretKey: string,
  params: RefundParams,
): Promise<PaystackRefund> {
  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/refund`,
    {
      transaction: params.reference,
      ...(params.amountGhs !== undefined ? { amount: Math.round(params.amountGhs * 100) } : {}),
      merchant_note: params.note,
    },
    { headers: { Authorization: `Bearer ${secretKey}` } },
  );
  return response.data.data as PaystackRefund;
}

export interface PaystackTransaction {
  /** "success" | "failed" | "abandoned" | "ongoing" | "pending" | … */
  status: string;
  reference: string;
  amount: number; // pesewas
  currency: string;
  paid_at: string | null;
}

/**
 * Asks Paystack directly whether a transaction succeeded.
 *
 * This is the **backstop for the webhook**, and it is exactly as trustworthy:
 * both are server-to-server exchanges authenticated with the secret key, and
 * neither takes the client's word for anything. The client can only ever supply
 * a reference, which it already knows.
 *
 * Two situations need it:
 *  - **Local development.** Paystack cannot reach `localhost`, so the webhook
 *    never arrives and an order would sit `payment_pending` forever after a
 *    genuinely successful payment.
 *  - **Production.** Webhooks get delayed, retried, or dropped. Without a pull
 *    path, a single lost delivery strands a paid order with no way back.
 *
 * Returns null when Paystack has no such transaction, so a made-up reference
 * reads as "not paid" rather than an error.
 */
export async function fetchPaystackTransaction(
  secretKey: string,
  reference: string,
): Promise<PaystackTransaction | null> {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    return response.data?.data as PaystackTransaction;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export function verifyPaystackSignature(secretKey: string, rawBody: string, signature: string): boolean {
  const hash = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return hash === signature;
}
