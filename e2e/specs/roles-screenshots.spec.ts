import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * The rider's feed and the shop's day, before and after the courier layout.
 *
 *   SHOT_PHASE=before npx playwright test -c e2e/playwright.shots.config.ts roles
 *   SHOT_PHASE=after  npx playwright test -c e2e/playwright.shots.config.ts roles
 */
const PHASE = process.env.SHOT_PHASE ?? "after";
const ROOT = resolve(__dirname, `../../screenshots/redesign/${PHASE}`);
mkdirSync(ROOT, { recursive: true });

// Mouse engine: the tab bar ignores synthesized presses under touch emulation.
test.use({
  hasTouch: false,
  isMobile: false,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  viewport: { width: 390, height: 844 },
});

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve(ROOT, `${name}.png`) });
}

async function skipOverlays(page: Page, role: RoleKey): Promise<void> {
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS[role].id);
}

test("@mobile rider feed", async ({ page }) => {
  await signIn(page, "rider");
  await skipOverlays(page, "rider");
  await page.goto("/");
  // "Available" before, "Hello" after — the spec runs against both commits.
  await page.getByText(/Available|Hello/).first().waitFor({ timeout: 90_000 });
  // Let the feed settle, or the frame catches the loading skeleton.
  await page
    .getByText(/Available to claim|Nothing waiting|You're offline/)
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "04-rider-feed");
});

test("@mobile shop today", async ({ page }) => {
  await signIn(page, "shop");
  await skipOverlays(page, "shop");
  await page.goto("/");
  await page.getByText(/Orders today|Hello/).first().waitFor({ timeout: 90_000 });
  await page.getByText(/All clear|Needs you/).first().waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "05-shop-today");
});
