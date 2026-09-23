import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * Home's top and the Wave counter, before and after folding the Wave into the
 * greeting panel.
 *
 *   SHOT_PHASE=before npx playwright test -c e2e/playwright.shots.config.ts wavetop
 *   SHOT_PHASE=after  npx playwright test -c e2e/playwright.shots.config.ts wavetop
 */
const PHASE = process.env.SHOT_PHASE ?? "after";
const ROOT = resolve(__dirname, `../../screenshots/wavetop/${PHASE}`);
mkdirSync(ROOT, { recursive: true });

// Mouse engine: the tab bar and the panel's rows ignore synthesized presses
// under touch emulation. See roles-screenshots.spec.ts.
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

test("@mobile home top and the Wave counter", async ({ page }) => {
  await signIn(page, "student");
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS["student" as RoleKey].id);

  await page.goto("/");
  await page.getByText("Send a package").first().waitFor({ timeout: 90_000 });
  // Wait for this student's own orders, or the frame is captured before the
  // payment card and the deliveries list have anything to draw.
  await page
    .getByText(/Active deliver|Finish paying|Move it again/)
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await shot(page, "01-home-top");

  // The Wave screen, where the counter now lives. Before the change the
  // countdown was a card on Home reached by "See all Waves"; after, it is the
  // panel's second line. Either way this opens the calendar.
  // Before, the whole banner was one button whose accessible name is the
  // countdown ("...ordering closes in 3d 22h"); after, it is the panel's note
  // ("...left to order"). Matching both lets one spec run against both commits.
  await page
    .getByRole("button", { name: /ordering closes in|left to order|Wave has closed/ })
    .first()
    .click();
  await page.getByText("When do you need it?").waitFor({ timeout: 30_000 });
  await shot(page, "02-wave-counter");
});
