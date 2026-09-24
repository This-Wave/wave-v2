import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * Every screen touched by a day of design work, in one pass, so the before and
 * after sets are captured under identical data and timing.
 *
 * The "before" set is built from `apps/mobile/src` at the last commit of
 * 2026-09-22, checked out over the working tree and then restored — the changes
 * are committed, so a stash cannot reach them. The API stays at HEAD either
 * way: the older client simply does not call the endpoints that did not exist
 * yet, and the newer one does.
 *
 *   SHOT_PHASE=before npx playwright test -c e2e/playwright.shots.config.ts everything
 *   SHOT_PHASE=after  npx playwright test -c e2e/playwright.shots.config.ts everything
 */
const PHASE = process.env.SHOT_PHASE ?? "after";
const ROOT = resolve(__dirname, `../../screenshots/everything/${PHASE}`);
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

async function open(page: Page, role: RoleKey): Promise<void> {
  await signIn(page, role);
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS[role].id);
  await page.goto("/");
}

/** Home's first paint differs between the two commits, so match either. */
const HOME_READY = /Send a package|Move a package|Start a pickup/;

test("@mobile 01 student home, first-time", async ({ page }) => {
  await page.route("**/orders/my", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"orders":[]}' }),
  );
  await open(page, "student");
  await page.getByText(HOME_READY).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  await shot(page, "01-student-home-empty");
});

test("@mobile 02 student home, with orders", async ({ page }) => {
  await open(page, "student");
  await page.getByText(HOME_READY).first().waitFor({ timeout: 90_000 });
  await page
    .getByText(/Active deliver|Move it again|Finish paying/)
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await shot(page, "02-student-home");
});

test("@mobile 03 student account", async ({ page }) => {
  await open(page, "student");
  await page.getByText(HOME_READY).first().waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: "Profile" }).first().click();
  await page.getByText(/Delivery checkpoints/).first().waitFor({ timeout: 30_000 });
  await shot(page, "03-student-account");
});

test("@mobile 04 the pickup form", async ({ page }) => {
  await open(page, "student");
  await page.getByText(HOME_READY).first().waitFor({ timeout: 90_000 });
  await page
    .getByRole("button", { name: /Send a package|Start a pickup|Move a package/ })
    .first()
    .click();
  await page.getByText(/What are we moving\?|The parcel/).first().waitFor({ timeout: 30_000 });
  await shot(page, "04-pickup-form");
});

test("@mobile 05 the Wave calendar", async ({ page }) => {
  await open(page, "student");
  await page.getByText(HOME_READY).first().waitFor({ timeout: 90_000 });
  await page
    .getByRole("button", {
      name: /Tap to choose a different day|left to order|ordering closes in|Wave has closed/,
    })
    .first()
    .click();
  await page.getByText("When do you need it?").waitFor({ timeout: 30_000 });
  await shot(page, "05-wave-calendar");
});

test("@mobile 06 rider feed", async ({ page }) => {
  await open(page, "rider");
  await page.getByText(/Hello,|Available/).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1800);
  await shot(page, "06-rider-feed");
});

test("@mobile 07 rider account", async ({ page }) => {
  await open(page, "rider");
  await page.getByText(/Hello,|Available/).first().waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: "Profile" }).first().click();
  await page.getByText(/VERIFICATION/).first().waitFor({ timeout: 30_000 });
  await shot(page, "07-rider-account");
});

test("@mobile 08 shop today", async ({ page }) => {
  await open(page, "shop");
  await page.getByText(/Hello,|Orders today/).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  await shot(page, "08-shop-today");
});

test("@mobile 09 shop menu", async ({ page }) => {
  await open(page, "shop");
  await page.getByText(/Hello,|Orders today/).first().waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: "Menu" }).first().click();
  await page.getByText("Menu").first().waitFor({ timeout: 30_000 });
  // Long enough for the products to land — or, before the fix, for the failure
  // to surface instead of sitting on blank skeletons.
  await page.waitForTimeout(2500);
  await shot(page, "09-shop-menu");
});

test("@mobile 10 shop settings", async ({ page }) => {
  await open(page, "shop");
  await page.getByText(/Hello,|Orders today/).first().waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: "Settings" }).first().click();
  // Visible-only: every visited screen stays mounted and hidden, so a bare
  // `.first()` resolves to the copy of "Serving" on the dashboard behind this.
  await page
    .getByText(/Serving/)
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: 30_000 });
  await shot(page, "10-shop-settings");
});
