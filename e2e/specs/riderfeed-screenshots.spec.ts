import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * The three states of the rider's feed.
 *
 * Written to prove two fixes that the redesign screenshots surfaced:
 *  - a hanging request used to leave the feed on its loading skeleton forever,
 *    because the axios client had no timeout;
 *  - going offline hid the section heading but still listed, and still let a
 *    rider claim, every order.
 *
 *   npx playwright test -c e2e/playwright.shots.config.ts riderfeed
 */
const ROOT = resolve(__dirname, "../../screenshots/riderfeed");
mkdirSync(ROOT, { recursive: true });

// Mouse engine: the switch and the tab bar ignore synthesized presses under
// touch emulation. See roles-screenshots.spec.ts.
test.use({
  hasTouch: false,
  isMobile: false,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  viewport: { width: 390, height: 844 },
});

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(ROOT, `${name}.png`) });
}

async function openFeed(page: Page): Promise<void> {
  await signIn(page, "rider");
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS["rider" as RoleKey].id);
  await page.goto("/");
  await page.getByText("Hello,").first().waitFor({ timeout: 90_000 });
}

test("@mobile online, the feed lists what there is to claim", async ({ page }) => {
  await openFeed(page);
  await expect(page.getByText("Available to claim")).toBeVisible({ timeout: 30_000 });
  await shot(page, "01-online");
});

test("@mobile offline empties the feed rather than unlabelling it", async ({ page }) => {
  await openFeed(page);
  // Wait for rows first, so the test proves they are removed and not merely
  // that they had yet to arrive.
  await expect(page.getByText("Available to claim")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("switch", { name: "Available for deliveries" }).click();

  await expect(page.getByText("You're offline").first()).toBeVisible();
  await expect(page.getByText("Available to claim")).toBeHidden();
  await expect(page.getByText("Mama Put Kitchen").first()).toBeHidden();
  await shot(page, "02-offline");

  // The switch writes through to the rider's profile, so leaving here would
  // leave the seed rider offline for every later test and for anyone opening
  // the app afterwards. Coming back online is worth asserting anyway: the rows
  // have to return from a query that was disabled, not merely stop being
  // hidden.
  await page.getByRole("switch", { name: "Available for deliveries" }).click();
  await expect(page.getByText("Available to claim")).toBeVisible({ timeout: 30_000 });
});

test("@mobile a hanging API ends in a retry, not an endless skeleton", async ({ page }) => {
  // Never fulfilled: the request hangs exactly as it did against a cold API.
  await page.route("**/orders/available", async () => {
    await new Promise(() => {});
  });

  await openFeed(page);
  // Guards against reading the wrong frame: an offline rider never fetches, so
  // the feed would be empty for a reason that has nothing to do with the hang.
  await expect(page.getByText("You're online")).toBeVisible({ timeout: 30_000 });
  // The skeleton is correct while the request is genuinely in flight.
  await shot(page, "03-hanging-skeleton");

  // The client timeout is 20s and react-query retries once, so the error state
  // is reached in roughly 40s. Before the fix this waited forever.
  await expect(page.getByRole("button", { name: /try again|retry/i }).first()).toBeVisible({
    timeout: 75_000,
  });
  await shot(page, "04-timed-out");
});
