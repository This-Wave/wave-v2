import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * The delivery stamp card, at the three counts that look different.
 *
 * The seed student has seven delivered orders, so live data only ever shows a
 * full card. The counts are faked with a route intercept — the screen derives
 * `completed` from the order list and nothing else on it reads the orders, so a
 * list of bare statuses is a sufficient fixture.
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

const delivered = (n: number) =>
  JSON.stringify({
    orders: Array.from({ length: n }, (_, i) => ({
      id: `00000000-0000-0000-0000-0000000009${String(i).padStart(2, "0")}`,
      status: "delivered",
      orderType: "pickup",
      deliveryFee: "20",
      discountApplied: "0",
      createdAt: new Date().toISOString(),
    })),
  });

async function openProfile(page: Page, count: number, name: string): Promise<void> {
  await page.route("**/orders/my", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: delivered(count) }),
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

test("@mobile a full card stops at six", async ({ page }) => {
  // Nine delivered, six slots: the card must not grow a seventh stamp.
  await openProfile(page, 9, "03-full");
  await expect(page.getByText("6 of 6").first()).toBeVisible();
  await expect(page.getByText(/Card full/).first()).toBeVisible();
});
