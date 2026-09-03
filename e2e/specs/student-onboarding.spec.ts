import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { API_URL } from "../fixtures/session";
import { createNewAccount, useAccount, deleteCreatedAccounts, type NewAccount } from "../fixtures/newAccount";

/**
 * A student, from a brand-new account to a placed order.
 *
 * Every other spec signs in as a seeded account that already has a profile, so
 * none of them can record onboarding — it happens once per account and those
 * accounts are long past it. This one creates a real throwaway Supabase user
 * with no `Profile` row, which is exactly the state a real signup is in the
 * moment the SMS code is accepted.
 *
 * Not recorded: the phone-number screen and the six-digit code. There is no
 * inbox to read, and no OTP bypass was added to the app to fake one — a code
 * path that mints a session without the code is worth more to an attacker than
 * to a test. The session is obtained by the password grant instead, the same
 * shortcut `session.ts` has always used.
 *
 * Stops at the Paystack hand-off. Completing a card or MoMo charge means a
 * third-party page and real money, which is checklist item 5 and needs a human.
 */
let account: NewAccount;

test.beforeEach(async ({ page }) => {
  account = await createNewAccount();
  await useAccount(page, account);
});

test.afterAll(async () => {
  await deleteCreatedAccounts();
});

test("a new student signs up, is taught the rules, and places a first order", async ({ page }) => {
  // --- Onboarding -------------------------------------------------------
  // A session with no profile resumes at the role picker rather than dumping
  // the user back on Welcome to request a second SMS code.
  await bootMobile(page, /How will you use Wave/i);

  await page.getByText("Order things", { exact: true }).click();
  await page.getByText("Continue", { exact: true }).click();

  await expect(onScreen(page, /Who are you/i)).toBeVisible();
  await page.getByPlaceholder("Kwame Mensah").fill("Adjoa Mensimah");
  await page.getByText("Start using Wave", { exact: true }).click();

  // --- The first-run tour ----------------------------------------------
  // The one thing a new student reliably gets wrong is assuming Wave is
  // on-demand, so the deck leads with the schedule.
  await expect(onScreen(page, /Wave runs on a schedule/i)).toBeVisible({ timeout: 30_000 });
  await page.getByText("Next", { exact: true }).click();
  await expect(onScreen(page, /Ask for anything/i)).toBeVisible();
  await page.getByText("Next", { exact: true }).click();
  await expect(onScreen(page, /Your PIN ends the delivery/i)).toBeVisible();
  await page.getByText("Got it", { exact: true }).click();

  // --- Into the app -----------------------------------------------------
  await expect(onScreen(page, /Mama Put Kitchen/)).toBeVisible({ timeout: 30_000 });

  // --- First order ------------------------------------------------------
  await page.getByText("Mama Put Kitchen").first().click();
  await expect(page.getByText(/STEP 1 OF 3/i)).toBeVisible();
  await page.getByLabel(/^Add /).first().click();
  await expect(onScreen(page, /1 item/i)).toBeVisible();

  await page.getByText("Continue", { exact: true }).click();
  await expect(page.getByText(/STEP 2 OF 3/i)).toBeVisible();

  await page.getByText("Review order", { exact: true }).click();
  await expect(page.getByText("What you pay")).toBeVisible();

  // A brand-new student has zero completed deliveries, so the loyalty
  // discount must NOT appear — it is earned at six, and showing it here would
  // be a promise Wave does not keep.
  await expect(page.getByText(/Loyalty discount/i)).toHaveCount(0);

  await page.getByText("Place order", { exact: true }).click();

  // The order must exist server-side, whatever the screen shows.
  const token = account.session.access_token as string;
  await expect
    .poll(
      async () => {
        const response = await fetch(`${API_URL}/orders/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json();
        return (body.orders ?? body).length;
      },
      { timeout: 45_000, message: "the new student's first order reaches Neon" },
    )
    .toBe(1);

  await expect(onScreen(page, /pay|payment|momo|card/i)).toBeVisible({ timeout: 30_000 });
});
