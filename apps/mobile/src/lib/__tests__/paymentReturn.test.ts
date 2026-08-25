import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Platform } from "react-native";
import {
  clearPendingPayment,
  consumePaymentReturn,
  readPendingPayment,
  stashPendingPayment,
  webAppOrigin,
} from "../paymentReturn";

/**
 * The web checkout hand-off (review 02-qa-engineer, H1 — "payment
 * state-machine unit tests").
 *
 * The student leaves the app for Paystack and comes back through a redirect,
 * so the order id has to survive a full page load in `sessionStorage` while the
 * reference arrives in the URL. Getting this wrong strands a student who has
 * already paid, which is the worst failure the app has.
 */
const PENDING = { orderId: "order-1", reference: "WAVE-order-1-123", totalAmount: 40 };

function fakeSessionStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    _store: store,
  };
}

function setUrl(href: string) {
  const replaceState = vi.fn();
  (globalThis as Record<string, unknown>).window = {
    location: { href, origin: new URL(href).origin },
    history: { replaceState },
  };
  return replaceState;
}

beforeEach(() => {
  Platform.OS = "web";
  (globalThis as Record<string, unknown>).sessionStorage = fakeSessionStorage();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).sessionStorage;
  delete (globalThis as Record<string, unknown>).window;
  Platform.OS = "ios";
});

describe("stash / read / clear", () => {
  test("round-trips a pending payment", () => {
    stashPendingPayment(PENDING);
    expect(readPendingPayment()).toEqual(PENDING);
  });

  test("clear removes it", () => {
    stashPendingPayment(PENDING);
    clearPendingPayment();
    expect(readPendingPayment()).toBeNull();
  });

  test("reads null when nothing was stashed", () => {
    expect(readPendingPayment()).toBeNull();
  });

  test("survives corrupt JSON rather than throwing", () => {
    // A half-written value must not crash the app on launch.
    (globalThis as { sessionStorage: Storage }).sessionStorage.setItem(
      "wave_pending_payment",
      "{not json",
    );
    expect(readPendingPayment()).toBeNull();
  });

  test("is inert on native, where there is no sessionStorage", () => {
    Platform.OS = "ios";
    stashPendingPayment(PENDING);
    expect(readPendingPayment()).toBeNull();
  });
});

describe("consumePaymentReturn", () => {
  test("returns null on an ordinary page load", () => {
    setUrl("https://wave.example.com/orders");
    stashPendingPayment(PENDING);

    // No flag and no reference: this is not a return from Paystack, so the
    // stash must be left alone for the real return.
    expect(consumePaymentReturn()).toBeNull();
    expect(readPendingPayment()).toEqual(PENDING);
  });

  test("recognises the wave_payment flag", () => {
    setUrl("https://wave.example.com/orders?wave_payment=1");
    stashPendingPayment(PENDING);

    expect(consumePaymentReturn()).toEqual(PENDING);
  });

  test("prefers the reference from the URL over the stashed one", () => {
    // Paystack is the authority on which transaction actually ran.
    setUrl("https://wave.example.com/?wave_payment=1&reference=PAYSTACK-REF-9");
    stashPendingPayment(PENDING);

    expect(consumePaymentReturn()).toEqual({ ...PENDING, reference: "PAYSTACK-REF-9" });
  });

  test("accepts trxref, Paystack's other parameter name", () => {
    setUrl("https://wave.example.com/?trxref=PAYSTACK-REF-9");
    stashPendingPayment(PENDING);

    expect(consumePaymentReturn()).toEqual({ ...PENDING, reference: "PAYSTACK-REF-9" });
  });

  test("falls back to the stashed reference when the URL carries none", () => {
    setUrl("https://wave.example.com/?wave_payment=1");
    stashPendingPayment(PENDING);

    expect(consumePaymentReturn()!.reference).toBe(PENDING.reference);
  });

  test("clears the stash so a refresh cannot re-enter the flow", () => {
    setUrl("https://wave.example.com/?wave_payment=1");
    stashPendingPayment(PENDING);

    consumePaymentReturn();

    expect(readPendingPayment()).toBeNull();
    expect(consumePaymentReturn()).toBeNull();
  });

  test("strips the query params from the address bar", () => {
    const replaceState = setUrl("https://wave.example.com/orders?wave_payment=1&reference=R1#top");
    stashPendingPayment(PENDING);

    consumePaymentReturn();

    expect(replaceState).toHaveBeenCalledWith({}, "", "/orders#top");
  });

  test("returns null when a return arrives with nothing stashed", () => {
    // Someone pasted the redirect URL, or the tab was closed and reopened.
    // There is no order to resume, and the app must not invent one.
    setUrl("https://wave.example.com/?wave_payment=1&reference=R1");

    expect(consumePaymentReturn()).toBeNull();
  });

  test("still cleans the URL when there was nothing to resume", () => {
    const replaceState = setUrl("https://wave.example.com/?wave_payment=1&reference=R1");

    consumePaymentReturn();

    expect(replaceState).toHaveBeenCalled();
  });

  test("is inert on native", () => {
    Platform.OS = "ios";
    setUrl("https://wave.example.com/?wave_payment=1");

    expect(consumePaymentReturn()).toBeNull();
  });
});

describe("webAppOrigin", () => {
  test("returns the origin on web", () => {
    setUrl("https://wave.example.com/orders?x=1");
    expect(webAppOrigin()).toBe("https://wave.example.com");
  });

  test("returns undefined on native, so the API keeps its own default", () => {
    Platform.OS = "ios";
    setUrl("https://wave.example.com/");
    expect(webAppOrigin()).toBeUndefined();
  });
});
