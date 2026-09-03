import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { API_URL } from "../fixtures/session";
import { step } from "../fixtures/narrate";
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
  await bootMobile(page, /How will you use Wave/i);

  await step(
    page,
    "A brand-new student",
    "The phone number and SMS code are already accepted. This account has no profile yet — so the app resumes at the role picker instead of sending them back to the start.",
  );

  // --- Choosing a role --------------------------------------------------
  await step(
    page,
    "Step 1 — Who are you here to be?",
    "Until now this screen did not exist: every signup silently became a student.",
  );

  await page.getByText("Order things", { exact: true }).click();
  await page.getByText("Continue", { exact: true }).click();

  // --- Profile ----------------------------------------------------------
  await step(
    page,
    "Step 2 — Your name",
    "A runner needs a name to look for at the checkpoint. The wording changes per role — a shop owner is asked for theirs, not the shop's.",
  );

  await expect(onScreen(page, /Who are you/i)).toBeVisible();
  await page.getByPlaceholder("Kwame Mensah").fill("Adjoa Mensimah");
  await page.getByText("Start using Wave", { exact: true }).click();

  // --- The tour ---------------------------------------------------------
  await expect(onScreen(page, /Wave runs on a schedule/i)).toBeVisible({ timeout: 30_000 });
  await step(
    page,
    "Step 3 — Three things to know",
    "Shown once, after signing in — never in front of it. The single hardest thing to explain about Wave is that it is scheduled, not on-demand, so that card comes first.",
  );

  await page.getByText("Next", { exact: true }).click();
  await expect(onScreen(page, /Ask for anything/i)).toBeVisible();
  await page.getByText("Next", { exact: true }).click();
  await expect(onScreen(page, /Your PIN ends the delivery/i)).toBeVisible();
  await page.getByText("Got it", { exact: true }).click();

  // --- Into the app -----------------------------------------------------
  await expect(onScreen(page, /Mama Put Kitchen/)).toBeVisible({ timeout: 30_000 });
  await step(page, "Onboarding done", "Straight into the live shop list for their campus.");

  // --- First order ------------------------------------------------------
  await step(page, "Step 4 — Their first order", "Pick a shop, then an item.");

  await page.getByText("Mama Put Kitchen").first().click();
  await expect(page.getByText(/STEP 1 OF 3/i)).toBeVisible();
  await page.getByLabel(/^Add /).first().click();
  await expect(onScreen(page, /1 item/i)).toBeVisible();

  await page.getByText("Continue", { exact: true }).click();
  await expect(page.getByText(/STEP 2 OF 3/i)).toBeVisible();
  await step(page, "Step 5 — Where to meet", "Delivery is to a campus checkpoint, never a room.");

  await page.getByText("Review order", { exact: true }).click();
  await expect(page.getByText("What you pay")).toBeVisible();

  await step(
    page,
    "Step 6 — The money, itemised",
    "Every figure here is calculated by the server, never by the phone. No loyalty discount appears — that is earned after six deliveries, and this student has none.",
  );

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

  await step(
    page,
    "Order placed — and real",
    "Confirmed in the database, not just on screen. The recording stops here: paying means Paystack's own page and real money, which still needs a human.",
    3000,
  );
});
