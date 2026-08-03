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

export function verifyPaystackSignature(secretKey: string, rawBody: string, signature: string): boolean {
  const hash = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return hash === signature;
}
