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
 * Confirmation is asynchronous and always will be: Paystack returns the student
 * the moment they authorise, but the order is only marked paid once Paystack's
 * signed webhook reaches our API. Embedding checkout in the app does not remove
 * that gap — it only tells us the student definitely finished, so we can afford
 * to wait properly instead of guessing.
 *
 * ⚠️ The default here is deliberately patient. The previous default was 5
 * attempts at 1.5s — about 7 seconds — which was fine on native, where the
 * `await` on the browser only resolves once the student returns. On **web**
 * `openBrowserAsync` resolves the instant the tab opens, so those 7 seconds
 * elapsed while the student was still looking at the Paystack page, and the app
 * announced "We couldn't confirm that" before they had typed anything. Callers
 * now start this only after checkout has genuinely completed.
 *
 * `onTick` reports progress so the screen can say how long it has been waiting
 * rather than showing an unexplained spinner.
 */
export async function waitForPayment(
  reference: string,
  {
    attempts = 40,
    intervalMs = 1500,
    onTick,
    signal,
  }: {
    attempts?: number;
    intervalMs?: number;
    onTick?: (elapsedMs: number) => void;
    signal?: { cancelled: boolean };
  } = {},
): Promise<PaymentStatus | null> {
  for (let i = 0; i < attempts; i += 1) {
    if (signal?.cancelled) return null;
    try {
      const status = await fetchPaymentStatus(reference);
      if (isPaid(status)) return status;
    } catch {
      // A network blip shouldn't end the wait — the next attempt may succeed.
    }
    onTick?.(i * intervalMs);
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}
