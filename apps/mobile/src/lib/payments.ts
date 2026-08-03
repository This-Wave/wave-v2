import { useMutation } from "@tanstack/react-query";
import { api } from "./api";

export type PaymentMethod = "momo" | "card";

interface InitiatePaymentResponse {
  payment_url: string;
  reference: string;
}

export function useInitiatePayment() {
  return useMutation({
    // The method is forwarded so Paystack opens on the channel the student
    // already chose, rather than asking them to pick a second time.
    mutationFn: async ({ orderId, method }: { orderId: string; method: PaymentMethod }) => {
      const { data } = await api.post<InitiatePaymentResponse>("/payments/initiate", {
        orderId,
        method,
      });
      return data;
    },
  });
}

export type PaymentStatus = { status: string; paidAt: string | null };

/**
 * Asks the API whether the order actually got paid.
 *
 * Not a hook: this runs once, after the checkout browser closes, at a moment
 * react-query has no natural trigger for.
 */
export async function fetchPaymentStatus(reference: string): Promise<PaymentStatus> {
  const { data } = await api.get<PaymentStatus>(`/payments/verify/${encodeURIComponent(reference)}`);
  return data;
}

/** Statuses that mean the money arrived — anything at or past `confirmed`. */
const PAID_STATUSES = ["confirmed", "rider_assigned", "en_route", "at_checkpoint", "delivered"];

export function isPaid(status: PaymentStatus): boolean {
  return Boolean(status.paidAt) || PAID_STATUSES.includes(status.status);
}

/**
 * Polls until the order shows as paid, or gives up.
 *
 * Confirmation is asynchronous: Paystack returns the student the moment they
 * authorise, but the order is only marked paid once Paystack's webhook reaches
 * our API, which can trail by a few seconds. Answering "not paid" at the instant
 * the browser closes would tell a student who just paid that they hadn't.
 */
export async function waitForPayment(
  reference: string,
  { attempts = 5, intervalMs = 1500 }: { attempts?: number; intervalMs?: number } = {},
): Promise<PaymentStatus | null> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const status = await fetchPaymentStatus(reference);
      if (isPaid(status)) return status;
    } catch {
      // A network blip shouldn't end the wait — the next attempt may succeed.
    }
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}
