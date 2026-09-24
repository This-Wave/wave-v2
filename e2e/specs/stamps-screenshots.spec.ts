import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * The delivery stamp card, at the counts that look different.
 *
 * The reward is one-shot, so the card comes from `GET /loyalty` rather than
 * being counted out of the order list — which is exactly why the fixture is an
 * intercept on that endpoint. The seed student sits on 1 stamp (7 lifetime
 * deliveries, one card already spent), so live data shows neither a full card
 * nor an empty one.
 *
 *   npx playwright test -c e2e/playwright.shots.config.ts stamps
 */
const ROOT = resolve(__dirname, "../../screenshots/stamps");
mkdirSync(ROOT, { recursive: true });

test.use({
  hasTouch: false,
  isMobile: false,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  viewport: { width: 390, height: 844 },
});

const loyalty = (stamps: number, pending = false) =>
  JSON.stringify({
    stamps,
    threshold: 6,
    discountPct: 20,
    totalDeliveries: stamps,
    rewardReady: stamps >= 6 && !pending,
    rewardPending: stamps >= 6 && pending,
  });

async function openProfile(
  page: Page,
  count: number,
  name: string,
  pending = false,
): Promise<void> {
  await page.route("**/loyalty", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: loyalty(count, pending) }),
  );
  await signIn(page, "student");
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS["student" as RoleKey].id);

  await page.goto("/");
  await page.getByText("Send a package").first().waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: "Profile" }).first().click();
  await expect(page.getByText("Delivery stamps").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(ROOT, `${name}.png`) });
}

test("@mobile a card with two stamps", async ({ page }) => {
  await openProfile(page, 2, "01-two-stamps");
  // The count has to be readable as text, not only as filled squares.
  await expect(page.getByText("2 of 6").first()).toBeVisible();
  await expect(page.getByText(/4 more deliveries/).first()).toBeVisible();
});

test("@mobile an empty card", async ({ page }) => {
  await openProfile(page, 0, "02-empty");
  await expect(page.getByText("0 of 6").first()).toBeVisible();
});

test("@mobile a full card stops at six and says the reward is ready", async ({ page }) => {
  // Nine stamps, six slots: the card must not grow a seventh.
  await openProfile(page, 9, "03-full");
  await expect(page.getByText("6 of 6").first()).toBeVisible();
  await expect(page.getByText(/Reward ready/).first()).toBeVisible();
});

test("@mobile a full card already spent on an unpaid order says so", async ({ page }) => {
  // Saying "reward ready" here would promise a discount the next order will not
  // get, because the order route refuses a second one while this is open.
  await openProfile(page, 6, "04-pending", true);
  await expect(page.getByText(/haven't paid for yet/).first()).toBeVisible();
});
