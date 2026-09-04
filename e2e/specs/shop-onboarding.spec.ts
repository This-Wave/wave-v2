import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { API_URL, tokenFor } from "../fixtures/session";
import { step, aside } from "../fixtures/narrate";
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

  await bootMobile(page, /How will you use Wave/i);

  await step(
    page,
    "A brand-new shop owner",
    "The one role that signs up owning nothing. Until today there was no way for them to create a shop at all — only an admin could.",
  );

  // --- Choosing a role --------------------------------------------------
  await step(page, "Step 1 — Choosing to sell", "Again, the wait is stated before the choice.");

  await page.getByText("Sell on Wave", { exact: true }).click();
  await expect(onScreen(page, /Needs approval/i)).toBeVisible();
  await page.getByText("Continue", { exact: true }).click();

  // --- Profile ----------------------------------------------------------
  await step(
    page,
    "Step 2 — The person, not the shop",
    "Note the wording changed for this role: it asks who runs the shop. The shop itself comes next.",
  );

  await expect(onScreen(page, /Who runs the shop/i)).toBeVisible();
  await page.getByPlaceholder("Kwame Mensah").fill("Akosua Frimpong");
  await page.getByText("Continue to shop details", { exact: true }).click();

  // --- The shop ---------------------------------------------------------
  await expect(onScreen(page, /Add your shop/i)).toBeVisible({ timeout: 30_000 });

  await step(
    page,
    "Step 3 — Describing the shop",
    "Name, category and where to find it. This screen is new; without it a self-registered owner reached a dashboard with no shop and no way to make one.",
  );

  await page.getByPlaceholder("Berekuso Mini Mart").fill(shopName);
  await page.getByText("Choose a category", { exact: true }).click();
  await page.getByText("Groceries", { exact: true }).click();
  await page.getByPlaceholder("Opposite the Berekuso junction").fill("Beside the campus gate");
  await page.getByText("Submit for approval", { exact: true }).click();

  // --- Waiting ----------------------------------------------------------
  await expect(onScreen(page, /Waiting for approval/i)).toBeVisible({ timeout: 60_000 });

  await step(
    page,
    "Step 4 — Real, but invisible",
    "The shop exists and no student can see it. This used to read 'Serving' — an owner would sit waiting for orders that could never arrive, unable to tell that from Wave having no customers.",
    3200,
  );

  await expect(onScreen(page, /Awaiting approval/i)).toBeVisible();

  // The public list is unauthenticated, so this is exactly what a student's
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

  await aside(
    page,
    "Step 5 — An admin approves",
    "Done from the dashboard, where the Approve button also did not exist until now — the server would accept the change but nothing could send it.",
    async () => {
      const approved = await fetch(`${API_URL}/admin/shops/${shop.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified: true }),
      });
      expect(approved.status, "admin approval").toBeLessThan(400);
    },
  );

  // --- Live -------------------------------------------------------------
  await page.reload();
  await expect(onScreen(page, /Serving/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Waiting for approval/i)).toHaveCount(0);

  await step(
    page,
    "Step 6 — Open for business",
    "The banner is gone and the badge now genuinely means what it says.",
  );

  const publicAfter = await (await fetch(`${API_URL}/shops`)).json();
  const namesAfter: string[] = (publicAfter.shops ?? publicAfter).map((s: { name: string }) => s.name);
  expect(namesAfter, "approval is what puts a shop in front of students").toContain(shopName);

  await step(
    page,
    "Visible to students",
    "Checked against the same public list a student's app reads: the shop was absent before approval and is present after it.",
    3000,
  );

  // Leave the directory as we found it — this shop has no products and would
  // otherwise sit in the students' list forever.
  await fetch(`${API_URL}/admin/shops/${shop.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ isVerified: false, isActive: false }),
  });
});
