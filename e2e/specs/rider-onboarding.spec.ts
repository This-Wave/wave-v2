import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { API_URL, tokenFor } from "../fixtures/session";
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
 *    on web that is a file input, but the upload path encodes base64 through
 *    the app's own uploader, and driving it through the DOM tests the browser's
 *    file dialog rather than Wave. The images are posted straight to
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

  // --- Onboarding -------------------------------------------------------
  await bootMobile(page, /How will you use Wave/i);

  await page.getByText("Deliver orders", { exact: true }).click();
  // The role picker must warn about verification before it is chosen, not
  // after — a rider who signs up expecting to work today has been misled.
  await expect(onScreen(page, /Needs ID verification/i)).toBeVisible();
  await page.getByText("Continue", { exact: true }).click();

  await expect(onScreen(page, /Who are you/i)).toBeVisible();
  await page.getByPlaceholder("Kwame Mensah").fill("Yaw Darko");
  await page.getByText("Continue to verification", { exact: true }).click();

  // --- The gate ---------------------------------------------------------
  // No verification row yet, so the stack opens on the submit form.
  await expect(onScreen(page, /verification|ID|Ghana Card/i)).toBeVisible({ timeout: 30_000 });

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

  const [idImagePath, selfiePath] = [await upload("id"), await upload("selfie")];
  const submitted = await fetch(`${API_URL}/riders/verification`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ idType: "ghana_card", idNumber: "GHA-000000000-0", idImagePath, selfiePath }),
  });
  expect(submitted.status, "verification submitted").toBeLessThan(400);

  // --- Waiting ----------------------------------------------------------
  await page.reload();
  await expect(onScreen(page, /Verification submitted|reviewing your ID/i)).toBeVisible({ timeout: 60_000 });
  // Still no feed while pending.
  await expect(page.getByText("Feed", { exact: true })).toHaveCount(0);

  // --- An admin approves ------------------------------------------------
  const adminToken = await tokenFor("admin");
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

  // --- Through the gate -------------------------------------------------
  // "Check status" refetches the profile, which is where `isVerified` lives —
  // polling only the verification row would say approved while the app still
  // refused to let them in.
  await page.getByText("Check status", { exact: true }).click();

  await expect(onScreen(page, /Feed|Available/i)).toBeVisible({ timeout: 60_000 });
  // A real job, with a fee and a destination, is what "let through" means.
  await expect(onScreen(page, /GH₵/)).toBeVisible({ timeout: 30_000 });
});
