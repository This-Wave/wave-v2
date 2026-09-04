import { describe, expect, test } from "vitest";
import { initialRiderOnboardingRoute } from "../rider";

/**
 * The rider verification gate's one decision.
 *
 * `orders/routes.ts` has always refused an unverified rider's accept, but until
 * onboarding existed nothing in the app read `isVerified` — a new rider saw the
 * live order feed and got an unexplained failure on every attempt to work. This
 * covers the choice the gate makes once, on mount, where both wrong answers are
 * silent: a duplicate submission, or an indefinite wait for a review nobody was
 * ever asked for.
 */
describe("initialRiderOnboardingRoute", () => {
  test("a rider who has never submitted gets the form", () => {
    expect(initialRiderOnboardingRoute(null, false)).toBe("SubmitVerification");
  });

  test("undefined is treated the same as no row", () => {
    expect(initialRiderOnboardingRoute(undefined, false)).toBe("SubmitVerification");
  });

  test("a rider awaiting review waits rather than resubmitting", () => {
    expect(initialRiderOnboardingRoute({ status: "pending" }, false)).toBe("VerificationPending");
  });

  test("a rejected rider sees the reason before the form", () => {
    // Dropping them straight into a blank form is how the same unusable photo
    // gets sent back twice.
    expect(initialRiderOnboardingRoute({ status: "rejected" }, false)).toBe("VerificationPending");
  });

  test("an approved row with a stale profile lands on the status screen", () => {
    // The gate reads profile.isVerified; if that is still false while the
    // verification says approved, "Check status" on the pending screen is what
    // refetches the profile and lets them in.
    expect(initialRiderOnboardingRoute({ status: "approved" }, false)).toBe("VerificationPending");
  });

  test("while loading, wait rather than show the form", () => {
    // Guessing "form" here flashes a submit screen at a rider whose documents
    // are already in, and invites a duplicate.
    expect(initialRiderOnboardingRoute(undefined, true)).toBe("VerificationPending");
    expect(initialRiderOnboardingRoute(null, true)).toBe("VerificationPending");
  });
});
