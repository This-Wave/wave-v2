import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * Home and the three account screens, before and after the reference pass.
 *
 *   SHOT_PHASE=before npx playwright test -c e2e/playwright.shots.config.ts refresh
 *   SHOT_PHASE=after  npx playwright test -c e2e/playwright.shots.config.ts refresh
 */
const PHASE = process.env.SHOT_PHASE ?? "after";
const ROOT = resolve(__dirname, `../../screenshots/refresh/${PHASE}`);
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
  await page.waitForTimeout(800);
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

test("@mobile student Home, with nothing on it yet", async ({ page }) => {
  // A first-time student: the state the reference pass was judged against.
  await page.route("**/orders/my", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"orders":[]}' }),
  );
  await open(page, "student");
  await page.getByText("Send a package").first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  await shot(page, "01-home");
});

test("@mobile student Home, with orders", async ({ page }) => {
  await open(page, "student");
  await page.getByText("Send a package").first().waitFor({ timeout: 90_000 });
  await page
    .getByText(/Active deliver|Move it again|Finish paying/)
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await shot(page, "02-home-with-orders");
});

test("@mobile the student's account screen", async ({ page }) => {
  await open(page, "student");
  await page.getByText("Send a package").first().waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: "Profile" }).first().click();
  await page.getByText(/Delivery checkpoints/).first().waitFor({ timeout: 30_000 });
  await shot(page, "03-student-account");
});

test("@mobile the rider's account screen", async ({ page }) => {
  await open(page, "rider");
  await page.getByText("Hello,").first().waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: "Profile" }).first().click();
  await page.getByText(/VERIFICATION/).first().waitFor({ timeout: 30_000 });
  await shot(page, "04-rider-account");
});

test("@mobile the shop's settings screen", async ({ page }) => {
  await open(page, "shop");
  await page.getByText("Hello,").first().waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: "Settings" }).first().click();
  await page.getByText(/Serving/).first().waitFor({ timeout: 30_000 });
  await shot(page, "05-shop-settings");
});
