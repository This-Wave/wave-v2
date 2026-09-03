import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { API_URL, tokenFor } from "../fixtures/session";
import { createNewAccount, useAccount, deleteCreatedAccounts, type NewAccount } from "../fixtures/newAccount";

/**
 * A shop owner, from a brand-new account to a storefront students can see.
 *
 * A shop owner is the one role that arrives owning nothing. Before onboarding
 * existed, shops were admin-created only: a self-registered owner landed on a
 * dashboard with no shop name, no orders and no way to make one, because every
 * shop screen acts on "the selected shop" and there was none.
 *
 * The approval step matters more than it looks. `POST /shops` leaves
 * `isVerified` false and the public shop routes filter on
 * `isActive && isVerified`, so a new shop is real but invisible. Its owner
 * cannot tell that apart from Wave simply having no customers — which is why
 * the dashboard says "Awaiting approval" in words rather than showing the
 * "Serving" pill it used to show unconditionally.
 *
 * The approval itself is done through the API because it belongs to a
 * different app; the admin dashboard's own Approve button is covered in
 * `admin.spec.ts`.
 */
let account: NewAccount;

test.beforeEach(async ({ page }) => {
  account = await createNewAccount();
  await useAccount(page, account);
});

test.afterAll(async () => {
  await deleteCreatedAccounts();
});

test("a new shop owner signs up, adds a shop, and goes live once approved", async ({ page }) => {
  const token = account.session.access_token as string;
  const shopName = `Berekuso Test Provisions ${Date.now()}`;

  // --- Onboarding -------------------------------------------------------
  await bootMobile(page, /How will you use Wave/i);

  await page.getByText("Sell on Wave", { exact: true }).click();
  // The wait must be stated before the choice is made.
  await expect(onScreen(page, /Needs approval/i)).toBeVisible();
  await page.getByText("Continue", { exact: true }).click();

  // The owner is asked for their own name, not the shop's — the shop comes next.
  await expect(onScreen(page, /Who runs the shop/i)).toBeVisible();
  await page.getByPlaceholder("Kwame Mensah").fill("Akosua Frimpong");
  await page.getByText("Continue to shop details", { exact: true }).click();

  // --- The shop ---------------------------------------------------------
  await expect(onScreen(page, /Add your shop/i)).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder("Berekuso Mini Mart").fill(shopName);
  await page.getByText("Choose a category", { exact: true }).click();
  await page.getByText("Groceries", { exact: true }).click();
  await page.getByPlaceholder("Opposite the Berekuso junction").fill("Beside the campus gate");
  await page.getByText("Submit for approval", { exact: true }).click();

  // --- Waiting ----------------------------------------------------------
  await expect(onScreen(page, /Waiting for approval/i)).toBeVisible({ timeout: 60_000 });
  // "Serving" here would be a lie the owner acts on — they would sit waiting
  // for orders that cannot arrive.
  await expect(onScreen(page, /Awaiting approval/i)).toBeVisible();

  // And students genuinely cannot see it yet. This is the assertion that
  // matters: the public list is unauthenticated, so this is what a student's
  // app would receive.
  const publicBefore = await (await fetch(`${API_URL}/shops`)).json();
  const namesBefore: string[] = (publicBefore.shops ?? publicBefore).map((s: { name: string }) => s.name);
  expect(namesBefore, "an unapproved shop is invisible to students").not.toContain(shopName);

  // --- An admin approves ------------------------------------------------
  const mine = await (
    await fetch(`${API_URL}/shops/my`, { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  const shop = (mine.shops ?? mine)[0];
  expect(shop?.name).toBe(shopName);
  expect(shop.isVerified, "a self-registered shop starts unapproved").toBe(false);

  const adminToken = await tokenFor("admin");
  const approved = await fetch(`${API_URL}/admin/shops/${shop.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ isVerified: true }),
  });
  expect(approved.status, "admin approval").toBeLessThan(400);

  // --- Live -------------------------------------------------------------
  await page.reload();
  await expect(onScreen(page, /Serving/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Waiting for approval/i)).toHaveCount(0);

  const publicAfter = await (await fetch(`${API_URL}/shops`)).json();
  const namesAfter: string[] = (publicAfter.shops ?? publicAfter).map((s: { name: string }) => s.name);
  expect(namesAfter, "approval is what puts a shop in front of students").toContain(shopName);

  // Leave the directory as we found it — this shop has no products and would
  // otherwise sit in the students' list forever.
  await fetch(`${API_URL}/admin/shops/${shop.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ isVerified: false, isActive: false }),
  });
});
