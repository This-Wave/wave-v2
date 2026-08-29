import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { signIn, tokenFor, API_URL } from "../fixtures/session";

/**
 * The student journey — the one that has to work for Wave to have a product.
 *
 * Browse → pick a shop → add an item → choose a checkpoint → review the
 * money → place the order → land on payment. The money screen is checked
 * arithmetically, because a delivery fee or a loyalty discount that is merely
 * *displayed* is the failure mode that costs real cedis.
 */

test.beforeEach(async ({ page }) => {
  await signIn(page, "student");
});

test("the home screen loads the live shop list and the current Wave", async ({ page }) => {
  await bootMobile(page, /Wave/);

  await expect(page.getByText("Mama Put Kitchen").first()).toBeVisible();
  // The Wave banner must show a real countdown, not a placeholder.
  await expect(page.getByText(/Arriving (Sunday|Wednesday)/i).first()).toBeVisible();
  await expect(page.getByText(/to order/i).first()).toBeVisible();
});

test("the category filter narrows the shop list", async ({ page }) => {
  await bootMobile(page, /Mama Put Kitchen/);

  await page.getByText("Pharmacy", { exact: true }).first().click();
  await expect(page.getByText("Berekuso Community Pharmacy").first()).toBeVisible();
  // A filter that does not actually filter is the bug worth catching.
  await expect(page.getByText("Mama Put Kitchen")).toHaveCount(0);

  await page.getByText("All", { exact: true }).first().click();
  await expect(page.getByText("Mama Put Kitchen").first()).toBeVisible();
});

test("the whole ordering flow, and the total is arithmetically right", async ({ page }) => {
  await bootMobile(page, /Mama Put Kitchen/);

  // Step 1 — menu
  await page.getByText("Mama Put Kitchen").first().click();
  await expect(page.getByText(/STEP 1 OF 3/i)).toBeVisible();
  await page.getByLabel(/^Add /).first().click();
  await expect(page.getByText(/1 item/i).first()).toBeVisible();

  // Step 2 — checkpoint + day
  await page.getByText("Continue", { exact: true }).click();
  await expect(page.getByText(/STEP 2 OF 3/i)).toBeVisible();
  await expect(onScreen(page, "Ashesi Quad")).toBeVisible();

  // Step 3 — the money
  await page.getByText("Review order", { exact: true }).click();
  await expect(page.getByText("What you pay")).toBeVisible();

  const summary = await page.locator("body").innerText();
  const cedis = (label: string): number => {
    const match = new RegExp(`${label}[\\s\\S]{0,40}?−?GH₵\\s?([\\d,]+(?:\\.\\d{2})?)`, "i").exec(summary);
    if (!match) throw new Error(`no "${label}" line on the summary:\n${summary}`);
    return Number(match[1].replace(/,/g, ""));
  };

  const items = cedis("Items");
  const delivery = cedis("Delivery");
  const total = cedis("Total");
  const discount = /Loyalty discount/i.test(summary) ? cedis("Loyalty discount") : 0;

  // Base delivery is GHS 20.00 (claude.md, changed 2026-08-07).
  expect(delivery, "base delivery fee").toBe(20);
  // The loyalty discount is 20% of the DELIVERY FEE ONLY — never off items.
  if (discount > 0) expect(discount).toBeCloseTo(delivery * 0.2, 2);
  expect(total, "items + delivery − discount").toBeCloseTo(items + delivery - discount, 2);
});

test("placing an order creates it server-side and hands off to Paystack", async ({ page }) => {
  const token = await tokenFor("student");
  const before = await (
    await fetch(`${API_URL}/orders/my`, { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  const countBefore = (before.orders ?? before).length;

  await bootMobile(page, /Mama Put Kitchen/);
  await page.getByText("Mama Put Kitchen").first().click();
  await expect(page.getByText(/STEP 1 OF 3/i)).toBeVisible();
  await page.getByLabel(/^Add /).first().click();
  // Wait for the cart bar; "Continue" does not exist until an item is in it.
  await expect(onScreen(page, /1 item/i)).toBeVisible();
  await page.getByText("Continue", { exact: true }).click();
  await expect(page.getByText(/STEP 2 OF 3/i)).toBeVisible();
  await page.getByText("Review order", { exact: true }).click();
  await expect(page.getByText("What you pay")).toBeVisible();

  await page.getByText("Place order", { exact: true }).click();

  // The order must exist in Neon, whatever the screen says.
  await expect
    .poll(
      async () => {
        const after = await (
          await fetch(`${API_URL}/orders/my`, { headers: { Authorization: `Bearer ${token}` } })
        ).json();
        return (after.orders ?? after).length;
      },
      { timeout: 45_000, message: "a new order row appears for the student" },
    )
    .toBe(countBefore + 1);

  // And the app must move the student somewhere that can take payment,
  // rather than stalling on the summary with their money uncollected.
  await expect(onScreen(page, /pay|payment|momo|card/i)).toBeVisible({ timeout: 30_000 });
});

test("orders, checkpoints and profile tabs all load", async ({ page }) => {
  await bootMobile(page, /Mama Put Kitchen/);

  await page.getByText("Orders", { exact: true }).first().click();
  await expect(onScreen(page, /GH₵/)).toBeVisible({ timeout: 20_000 });

  await page.getByText("Checkpoints", { exact: true }).first().click();
  await expect(onScreen(page, "Ashesi Quad")).toBeVisible({ timeout: 20_000 });

  await page.getByText("Profile", { exact: true }).first().click();
  await expect(onScreen(page, /Ama Owusu|\+?233/)).toBeVisible({ timeout: 20_000 });
});
