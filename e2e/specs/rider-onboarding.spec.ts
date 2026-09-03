import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { API_URL, tokenFor } from "../fixtures/session";
import { step, aside } from "../fixtures/narrate";
import { createNewAccount, useAccount, deleteCreatedAccounts, type NewAccount } from "../fixtures/newAccount";

/**
 * A rider, from a brand-new account to a live order feed.
 *
 * The interesting part is the gate. `orders/routes.ts` has always refused an
 * unverified rider's accept, but until onboarding existed nothing in the app
 * read `isVerified` — a new rider saw the real feed, complete with other
 * students' names and checkpoints, and got an unexplained failure on every
 * attempt to work. This records the honest version: submit documents, wait,
 * get approved, then and only then see the feed.
 *
 * Two steps are driven through the API rather than the screen, and both are
 * deliberate:
 *
 * 1. The ID photo and selfie. `expo-image-picker` opens the native picker;
 *    on web that is a file input, and driving it through the DOM tests the
 *    browser's file dialog rather than Wave. The images are posted straight to
 *    `/riders/verification/upload` instead.
 * 2. The approval itself, which is an admin action in a different app. The
 *    admin dashboard's own approval UI is covered in `admin.spec.ts`.
 */
let account: NewAccount;

const PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test.beforeEach(async ({ page }) => {
  account = await createNewAccount();
  await useAccount(page, account);
});

test.afterAll(async () => {
  await deleteCreatedAccounts();
});

test("a new rider signs up, is held at the gate, and is let through on approval", async ({ page }) => {
  const token = account.session.access_token as string;

  await bootMobile(page, /How will you use Wave/i);

  await step(
    page,
    "A brand-new rider",
    "Riders handle other people's money and shopping, so this journey is mostly about a check the app used to enforce silently.",
  );

  // --- Choosing a role --------------------------------------------------
  await step(
    page,
    "Step 1 — Choosing to deliver",
    "The wait is stated before the choice is made, not after. Someone signing up expecting to earn today has been misled.",
  );

  await page.getByText("Deliver orders", { exact: true }).click();
  await expect(onScreen(page, /Needs ID verification/i)).toBeVisible();
  await page.getByText("Continue", { exact: true }).click();

  // --- Profile ----------------------------------------------------------
  await step(page, "Step 2 — Their name", "Students see this when the rider takes their order.");

  await expect(onScreen(page, /Who are you/i)).toBeVisible();
  await page.getByPlaceholder("Kwame Mensah").fill("Yaw Darko");
  await page.getByText("Continue to verification", { exact: true }).click();

  // --- The gate ---------------------------------------------------------
  await expect(onScreen(page, /verification|ID|Ghana Card/i)).toBeVisible({ timeout: 30_000 });

  await step(
    page,
    "Step 3 — Held at the gate",
    "This is the whole app for an unverified rider. Before today they saw the live order feed instead — real students' names, orders and checkpoints — and got an unexplained error on every attempt to take one.",
    3200,
  );

  // The feed must be unreachable. This is the whole point of the gate: an
  // unvetted person must not be shown real customers' orders.
  await expect(page.getByText("Feed", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Earnings", { exact: true })).toHaveCount(0);

  // --- Submit the documents (see the note above) ------------------------
  const upload = async (kind: string): Promise<string> => {
    const response = await fetch(`${API_URL}/riders/verification/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kind, imageBase64: PIXEL_PNG, contentType: "image/png" }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`upload ${kind} failed: ${response.status} ${JSON.stringify(body)}`);
    return body.path as string;
  };

  await aside(
    page,
    "Step 4 — Sending ID and a selfie",
    "Done through the API here, because the photo picker is the phone's own, not Wave's. The images land in private storage an admin can read only through short-lived links.",
    async () => {
      const [idImagePath, selfiePath] = [await upload("id"), await upload("selfie")];
      const submitted = await fetch(`${API_URL}/riders/verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ idType: "ghana_card", idNumber: "GHA-000000000-0", idImagePath, selfiePath }),
      });
      expect(submitted.status, "verification submitted").toBeLessThan(400);
    },
  );

  // --- Waiting ----------------------------------------------------------
  await page.reload();
  await expect(onScreen(page, /Verification submitted|reviewing your ID/i)).toBeVisible({ timeout: 60_000 });

  await step(
    page,
    "Step 5 — Waiting, and told so",
    "Documents in, review pending. Still no feed. If an admin rejects them, this same screen shows the reason they gave.",
  );

  await expect(page.getByText("Feed", { exact: true })).toHaveCount(0);

  // --- An admin approves ------------------------------------------------
  const adminToken = await tokenFor("admin");

  await aside(
    page,
    "Step 6 — An admin approves",
    "Happening in the dashboard, not on this phone. Approval writes the flag the app actually reads.",
    async () => {
      const pending = await (
        await fetch(`${API_URL}/riders/admin/riders?status=pending`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      ).json();
      const mine = (pending.verifications ?? pending).find(
        (v: { riderId: string }) => v.riderId === account.id,
      );
      expect(mine, "the new rider's verification is queued for review").toBeTruthy();

      const approved = await fetch(`${API_URL}/riders/admin/riders/${mine.id}/verify`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      expect(approved.status, "admin approval").toBeLessThan(400);
    },
  );

  // --- Through the gate -------------------------------------------------
  await step(
    page,
    "Step 7 — Checking back",
    "This button refetches the rider's whole profile, not just the review. Approval is recorded on the profile, and that is the flag the gate reads.",
  );

  await page.getByText("Check status", { exact: true }).click();

  await expect(onScreen(page, /Feed|Available/i)).toBeVisible({ timeout: 60_000 });
  await expect(onScreen(page, /GH₵/)).toBeVisible({ timeout: 30_000 });

  await step(
    page,
    "Through the gate — real work",
    "The feed, with real jobs, a fee on each and a checkpoint to carry them to. Same screen as before; the difference is that now they are allowed to be here.",
    3000,
  );
});
