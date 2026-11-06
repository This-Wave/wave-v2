import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * The brand bar on the pages that are not a role's first tab.
 *
 * Three outcomes to cover: a tab page always shows the mark, a pushed screen
 * with no title shows it in the centre, and one of the three screens that does
 * pass a title (an order reference) keeps the title instead.
 *
 *   npx playwright test -c e2e/playwright.shots.config.ts brandbar
 */
const ROOT = resolve(__dirname, "../../screenshots/brandbar");
mkdirSync(ROOT, { recursive: true });

// Mouse engine: the tab bar ignores synthesized presses under touch emulation.
test.use({
  hasTouch: false,
  isMobile: false,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  viewport: { width: 390, height: 844 },
});

/**
 * Every screen the navigator has visited stays mounted and hidden, so a bare
 * `getByLabel("Wave")` matches lockups on screens nobody is looking at — and
 * `.first()` happily returns one of those. Counting only what is visible is the
 * assertion that means what it says.
 */
const visibleMarks = (page: Page) => page.locator('[aria-label="Wave"]:visible');

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(600);
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

test("@mobile the student's tab pages carry the mark", async ({ page }) => {
  await open(page, "student");
  await page.getByText("Send a package").first().waitFor({ timeout: 90_000 });
  // Home is the exception: its greeting panel is the top of the screen, so a
  // mark above it would be a second header.
  await expect(visibleMarks(page)).toHaveCount(0);
  await shot(page, "01-home-no-mark");

  for (const [tab, marker, name] of [
    ["Checkpoints", "Checkpoints", "02-checkpoints"],
    ["Profile", "Profile", "03-profile"],
  ] as const) {
    await page.getByRole("button", { name: tab }).first().click();
    await page.getByText(marker).first().waitFor({ timeout: 30_000 });
    await expect(visibleMarks(page)).toHaveCount(1);
    await shot(page, name);
  }
});

test("@mobile the rider's and shop's tab pages carry it too", async ({ page }) => {
  await open(page, "rider");
  await page.getByText("Hello,").first().waitFor({ timeout: 90_000 });
  // Feed is the rider's greeting-panel screen, so no mark.
  await expect(visibleMarks(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Earnings" }).first().click();
  await page.getByText("Earnings").first().waitFor({ timeout: 30_000 });
  await expect(visibleMarks(page)).toHaveCount(1);
  await shot(page, "06-rider-earnings");
});

test("@mobile the shop's tab pages carry it too", async ({ page }) => {
  await open(page, "shop");
  await page.getByText("Hello,").first().waitFor({ timeout: 90_000 });
  // Today is the shop's greeting-panel screen.
  await expect(visibleMarks(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Menu" }).first().click();
  await page.getByText("Menu").first().waitFor({ timeout: 30_000 });
  await expect(visibleMarks(page)).toHaveCount(1);
  // Let the products land. At the default settle the frame catches four blank
  // skeleton cards, which reads as a stuck list rather than a loading one.
  await page.waitForTimeout(2000);
  await shot(page, "07-shop-menu");
});

test("@mobile a pushed screen shows the mark, unless it has a title", async ({ page }) => {
  await open(page, "student");
  await page.getByText("Send a package").first().waitFor({ timeout: 90_000 });

  // The pickup form passes no title — it carries its own body heading — so the
  // mark takes the centre of the bar. 19 of the 22 pushed screens are like this.
  await page.getByRole("button", { name: /Send a package/ }).first().click();
  await page.getByText("What are we moving?").waitFor({ timeout: 30_000 });
  await expect(visibleMarks(page)).toHaveCount(1);
  await shot(page, "04-pushed-no-title");

  // An order's own screen passes the order reference as the title, which is
  // worth more to a student than the logo. One of exactly three such screens.
  await page.goto("/");
  await page.getByText("Send a package").first().waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Orders" }).first().click();
  // Visible-only for the same reason as `visibleMarks`: Home stays mounted and
  // carries its own copy of these rows, so an unfiltered `.first()` tries to
  // click something nobody can see.
  const track = page
    .getByRole("button", { name: "Track this order" })
    .filter({ visible: true })
    .first();
  await track.waitFor({ timeout: 30_000 });
  await track.click();
  await page.getByText("Delivery in progress").first().waitFor({ timeout: 30_000 });
  await expect(visibleMarks(page)).toHaveCount(0);
  await shot(page, "05-pushed-with-title");
});
