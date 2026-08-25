import { Platform } from "react-native";

const PENDING_KEY = "wave_pending_payment";

export type PendingPayment = {
  orderId: string;
  reference: string;
  totalAmount: number;
};

/** Stash checkout details before leaving the app tab for Paystack. */
export function stashPendingPayment(pending: PendingPayment) {
  if (Platform.OS !== "web" || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function readPendingPayment(): PendingPayment | null {
  if (Platform.OS !== "web" || typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingPayment;
  } catch {
    return null;
  }
}

export function clearPendingPayment() {
  if (Platform.OS !== "web" || typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(PENDING_KEY);
}

/**
 * After Paystack redirects back to this origin, pull the pending order + ref
 * out of the URL / sessionStorage and clean the address bar.
 */
export function consumePaymentReturn(): PendingPayment | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const flagged = url.searchParams.get("wave_payment") === "1";
  const reference =
    url.searchParams.get("reference") || url.searchParams.get("trxref") || undefined;

  if (!flagged && !reference) return null;

  const pending = readPendingPayment();
  clearPendingPayment();

  // Drop query params so a refresh doesn't re-enter the return flow.
  url.search = "";
  window.history.replaceState({}, "", url.pathname + url.hash);

  if (!pending) return null;
  return {
    ...pending,
    reference: reference || pending.reference,
  };
}

/** Origin of the running web app — sent to the API as Paystack's return target. */
export function webAppOrigin(): string | undefined {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  return window.location.origin;
}
