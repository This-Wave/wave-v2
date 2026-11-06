import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * Home with nothing on it.
 *
 * The seed student has a dozen orders, so the only way to see what a student
 * meets on their first open is to answer their order list with nothing. The
 * route intercept is the fixture — emptying the database would take the other
 * specs' data with it.
 *
 *   SHOT_PHASE=before npx playwright test -c e2e/playwright.shots.config.ts emptyhome
 *   SHOT_PHASE=after  npx playwright test -c e2e/playwright.shots.config.ts emptyhome
 */
const PHASE = process.env.SHOT_PHASE ?? "after";
const ROOT = resolve(__dirname, `../../screenshots/emptyhome/${PHASE}`);
mkdirSync(ROOT, { recursive: true });

test.use({
  hasTouch: false,
  isMobile: false,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  viewport: { width: 390, height: 844 },
});

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(ROOT, `${name}.png`) });
}

async function signInStudent(page: Page): Promise<void> {
  await signIn(page, "student");
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS["student" as RoleKey].id);
}

test("@mobile a first-time student's Home", async ({ page }) => {
  await page.route("**/orders/my", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"orders":[]}' }),
  );
  await signInStudent(page);
  await page.goto("/");
  await page.getByText("Send a package").first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  await shot(page, "01-newcomer");
});

test("@mobile Home while the orders are still loading", async ({ page }) => {
  // Held open, not failed: this is the state every student passes through on a
  // slow connection, and the screen has to hold its shape while it waits.
  await page.route("**/orders/my", async (route) => {
    await new Promise((r) => setTimeout(r, 12_000));
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"orders":[]}' });
  });
  await signInStudent(page);
  await page.goto("/");
  await page.getByText("Send a package").first().waitFor({ timeout: 90_000 });
  await shot(page, "02-loading");
});
