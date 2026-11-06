import { beforeEach, describe, expect, test } from "vitest";
import { isGuestNow, useAuthStore } from "../authStore";
import type { Profile } from "../../types";

const U = "uni-1";
const target = { route: "OrderSummary", params: { shopId: "s", items: [{ productId: "p", quantity: 2 }] } };

beforeEach(() => useAuthStore.getState().clearSession());

describe("guest session", () => {
  test("starting one makes the viewer a guest on that campus", () => {
    useAuthStore.getState().startGuest(U);
    expect(isGuestNow()).toBe(true);
    expect(useAuthStore.getState().guestUniversityId).toBe(U);
  });

  test("pressing Pay remembers the basket and opens sign-up", () => {
    useAuthStore.getState().startGuest(U);
    useAuthStore.getState().beginSignupFromGuest(target);
    const s = useAuthStore.getState();
    expect(s.signingUpFromGuest).toBe(true);
    expect(s.resume).toEqual(target);
  });

  test("backing out keeps the basket to go back to", () => {
    useAuthStore.getState().startGuest(U);
    useAuthStore.getState().beginSignupFromGuest(target);
    useAuthStore.getState().cancelSignupFromGuest();
    const s = useAuthStore.getState();
    expect(s.signingUpFromGuest).toBe(false);
    expect(isGuestNow()).toBe(true);
    expect(s.takeResume()).toEqual(target);
    expect(useAuthStore.getState().resume).toBeNull();
  });

  test("a new profile ends the guest session but keeps where to resume", () => {
    useAuthStore.getState().startGuest(U);
    useAuthStore.getState().beginSignupFromGuest(target);
    useAuthStore.getState().setProfile({ id: "p1", role: "student", universityId: U } as Profile);
    const s = useAuthStore.getState();
    expect(isGuestNow()).toBe(false);
    expect(s.guestUniversityId).toBeNull();
    expect(s.signingUpFromGuest).toBe(false);
    expect(s.takeResume()).toEqual(target);
  });

  test("signing out clears everything", () => {
    useAuthStore.getState().startGuest(U);
    useAuthStore.getState().beginSignupFromGuest(target);
    useAuthStore.getState().clearSession();
    const s = useAuthStore.getState();
    expect(s.guestUniversityId).toBeNull();
    expect(s.resume).toBeNull();
  });
});
