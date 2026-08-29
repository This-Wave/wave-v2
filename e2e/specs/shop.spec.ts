import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { signIn, tokenFor, API_URL } from "../fixtures/session";

/**
 * The shop-owner app. This dev owner holds all seven seeded shops, so the
 * switcher is exercised for real rather than being a one-item dropdown.
 */

test.beforeEach(async ({ page }) => {
  await signIn(page, "shop");
});

test("the dashboard opens on a shop and shows today's numbers", async ({ page }) => {
  await bootMobile(page, /Orders today|Serving/);

  await expect(page.getByText("Orders today")).toBeVisible();
  await expect(page.getByText(/Order value today/i)).toBeVisible();
  await expect(onScreen(page, /GH₵/)).toBeVisible();
});

test("the switcher only ever offers shops this owner actually owns", async ({ page }) => {
  const token = await tokenFor("shop");
  const mine = await (
    await fetch(`${API_URL}/shops/my`, { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  const owned: string[] = (mine.shops ?? mine).map((s: { name: string }) => s.name);

  await bootMobile(page, /Serving|Orders today/);

  // Switching must actually change the dashboard, and no shop belonging to
  // someone else may appear in the list.
  const second = owned[1];
  test.skip(!second, "this owner holds only one shop");
  await page.getByText(second, { exact: true }).first().click();
  await expect(onScreen(page, second)).toBeVisible();

  const body = await page.locator("body").innerText();
  const all = await (await fetch(`${API_URL}/shops`)).json();
  const foreign = (all.shops ?? all)
    .map((s: { name: string }) => s.name)
    .filter((name: string) => !owned.includes(name));
  for (const name of foreign) {
    expect(body, `a shop this owner does not own is listed: ${name}`).not.toContain(name);
  }
});

test("the orders and menu tabs load", async ({ page }) => {
  await bootMobile(page, /Orders today|Serving/);

  await page.getByText("Orders", { exact: true }).first().click();
  await expect(onScreen(page, /GH₵|no orders|nothing|All clear/i)).toBeVisible({ timeout: 20_000 });

  await page.getByText("Menu", { exact: true }).first().click();
  await expect(onScreen(page, /GH₵|add|item/i)).toBeVisible({ timeout: 20_000 });

  await page.getByText("Settings", { exact: true }).first().click();
  // Settings is where the owner turns the shop on and off — that switch is the
  // screen's whole reason to exist, so assert on it rather than on prose.
  await expect(page.getByRole("switch", { name: /serving/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
});
