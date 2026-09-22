import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * Release-day state: Buy for me not launched, Pickup only.
 *
 * Expects the global `buy_for_me` switch paused **and hidden**, which is what
 * the `prelaunch_buy_for_me` migration writes on a fresh database.
 *   npx playwright test -c e2e/playwright.shots.config.ts prelaunch-screenshots
 */
const ROOT = resolve(__dirname, "../../screenshots/prelaunch");
mkdirSync(ROOT, { recursive: true });

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(ROOT, `${name}.png`), fullPage });
}

async function skipOverlays(page: Page, role: RoleKey): Promise<void> {
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS[role].id);
}

test("@admin the switch and the nudge", async ({ page }) => {
  await signIn(page, "admin");

  await page.goto("/config");
  await page.getByText("Not launched", { exact: true }).first().waitFor();
  await shot(page, "admin-01-buy-for-me-not-launched");

  await page.goto("/dashboard");
  await page.getByText(/Buy for me (is ready to open|hasn't launched yet)/).waitFor();
  await shot(page, "admin-02-dashboard-readiness");
});

test("@mobile the student sees Pickup only", async ({ page }) => {
  await signIn(page, "student");
  await skipOverlays(page, "student");
  await page.goto("/");
  await page.getByText("Move a package").waitFor({ timeout: 60_000 });
  await shot(page, "app-03-home-pickup-only");
});
