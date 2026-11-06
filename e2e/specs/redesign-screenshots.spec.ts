import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * Home and the pickup form, before and after the courier-layout redesign.
 *
 * `SHOT_PHASE` names the folder, so the same spec produces both sets from two
 * different commits:
 *   SHOT_PHASE=before npx playwright test -c e2e/playwright.shots.config.ts redesign
 *   SHOT_PHASE=after  npx playwright test -c e2e/playwright.shots.config.ts redesign
 */
const PHASE = process.env.SHOT_PHASE ?? "after";
const ROOT = resolve(__dirname, `../../screenshots/redesign/${PHASE}`);
mkdirSync(ROOT, { recursive: true });

// The tab bar ignores synthesized presses under touch emulation; see
// moveagain-screenshots.spec.ts.
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

test("@mobile home and the pickup form", async ({ page }) => {
  await signIn(page, "student");
  await skipOverlays(page, "student");

  await page.goto("/");
  // Before the redesign Home led with "Move a package"; after, the tile says
  // "Send a package". The spec runs against both commits.
  await page.getByText(/Move a package|Send a package/).first().waitFor({ timeout: 90_000 });
  // Wait for the student's own orders, or the frame is captured before the
  // active-delivery and route sections have anything to draw.
  await page
    .getByText(/Active deliver|Move it again|Finish paying/)
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, "01-home-top");

  // Scrolled, so the whole of Home is on record either side of the change.
  await page.getByText(/Shop orders are coming|Can't find your shop/).scrollIntoViewIfNeeded();
  await shot(page, "02-home-bottom");

  await page.goto("/");
  await page.getByText(/Move a package|Send a package/).first().waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: /Start a pickup|Send a package/ }).first().click();
  await page.getByText("What are we moving?").waitFor({ timeout: 30_000 });
  await shot(page, "03-pickup-form");
});
