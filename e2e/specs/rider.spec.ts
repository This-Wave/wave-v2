import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { signIn, tokenFor, API_URL } from "../fixtures/session";

/**
 * The rider side. The feed, the availability toggle, earnings, and the
 * delivery-PIN lockout that was added on 2026-08-25 — the last one is a
 * security control, so it is checked at the API, where it actually lives.
 */

test.beforeEach(async ({ page }) => {
  await signIn(page, "rider");
});

test("the feed lists claimable jobs with a fee on each", async ({ page }) => {
  await bootMobile(page, /Feed|Available/);

  await expect(onScreen(page, /GH₵/)).toBeVisible();
  // Every job must name where it is going; a job with no checkpoint is
  // unpickable in real life.
  await expect(onScreen(page, /→/)).toBeVisible();
});

test("the availability toggle is the rider's own switch", async ({ page }) => {
  await bootMobile(page, /Feed|Available/);

  // isAvailable is the rider's toggle; isActive is the ban flag and must
  // never be written from here (handoff.md, 2026-08-25).
  await expect(onScreen(page, /Available|Online|Offline/)).toBeVisible();
});

test("the deliveries and earnings tabs load", async ({ page }) => {
  await bootMobile(page, /Feed|Available/);

  await page.getByText("Deliveries", { exact: false }).first().click();
  await expect(onScreen(page, /Ashesi Quad|no deliveries|nothing/i)).toBeVisible({ timeout: 20_000 });

  await page.getByText("Earnings", { exact: true }).first().click();
  await expect(onScreen(page, /GH₵/)).toBeVisible({ timeout: 20_000 });

  await page.getByText("Profile", { exact: true }).first().click();
  await expect(onScreen(page, /Kofi Boateng|233/)).toBeVisible({ timeout: 20_000 });
});

test("a rider cannot brute-force a delivery PIN", async ({ page }) => {
  // The cap is 5 attempts (handoff.md). Without it the assigned rider can
  // grind the 6-digit space and self-close a delivery they never handed over.
  const token = await tokenFor("rider");
  const orders = await (
    await fetch(`${API_URL}/orders/my-deliveries`, { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  const list = orders.orders ?? orders;
  test.skip(!Array.isArray(list) || list.length === 0, "no assigned order to test the PIN cap against");

  const target = list.find((o: { status: string }) => o.status === "at_checkpoint") ?? list[0];
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await fetch(`${API_URL}/orders/${target.id}/deliver`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "000000" }),
    });
    statuses.push(response.status);
    if (response.status === 429 || response.status === 423) break;
  }
  // It must stop accepting guesses. An endless 400 is the bug this guards.
  expect(statuses, `guessing was never locked out: ${statuses}`).toContain(429);
});
