import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { API_URL, mintSession, signIn } from "../fixtures/session";

/**
 * "Move it again" and the standing way to suggest a shop.
 *
 * Expects the student to have sent at least one pickup (the probe places
 * three, two of them on the same route). The Buy-for-me shots open the switch
 * and close it again, because release state is closed.
 *   npx playwright test -c e2e/playwright.shots.config.ts moveagain-screenshots
 */
/**
 * Captured with the mouse engine rather than touch emulation: in a
 * touch-emulated Chromium, a synthesized tap on the floating tab bar does not
 * reach React Native Web's Pressable, so the navigator never switches screens.
 * The phone viewport and base URL still come from the @mobile project.
 */
test.use({
  hasTouch: false,
  isMobile: false,
  // A desktop UA too: with the iPhone user-agent, React Native Web wires the
  // tab bar for touch only and a click never reaches it.
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  viewport: { width: 390, height: 844 },
});

const ROOT = resolve(__dirname, "../../screenshots/move-again");
mkdirSync(ROOT, { recursive: true });

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(ROOT, `${name}.png`) });
}

/**
 * Tap a tab and wait for the screen behind it.
 *
 * The first press on a freshly loaded dev bundle is sometimes swallowed while
 * the navigator settles, so this retries once rather than failing.
 */
async function openTab(page: Page, label: string, expect: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel(`${label} tab`).first().click();
    try {
      // `attached`, not visible: the row we are after can sit below the fold
      // on a phone, and the caller scrolls to it.
      await page.getByText(expect).first().waitFor({ state: "attached", timeout: 15_000 });
      return;
    } catch {
      if (attempt === 1) throw new Error(`${label} tab never showed "${expect}"`);
      await page.waitForTimeout(1500);
    }
  }
}

async function skipOverlays(page: Page, role: RoleKey): Promise<void> {
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS[role].id);
}

/** Open or close Buy for me as the owner, so the post-launch Home can be seen. */
async function setBuyForMe(paused: boolean): Promise<void> {
  const session = await mintSession("admin");
  const res = await fetch(`${API_URL}/admin/switches`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${session.access_token as string}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      key: "buy_for_me",
      universityId: null,
      paused,
      hidden: paused,
      message: paused ? "Buy for me is coming soon — we're signing up shops now. Pickup works today." : undefined,
    }),
  });
  if (!res.ok) throw new Error(`could not set the switch: ${res.status}`);
}

test("@mobile move it again, and suggesting a shop", async ({ page }) => {
  await signIn(page, "student");
  await skipOverlays(page, "student");

  await page.goto("/");
  await page.getByText("Move it again").waitFor({ timeout: 60_000 });
  await page.getByText("Move it again").scrollIntoViewIfNeeded();
  await shot(page, "app-01-move-it-again");

  // One tap lands on the pickup form with both ends already chosen.
  await page.getByText("Ashesi Quad → Hostel Block A").click();
  await page.getByText("What are we moving?").waitFor();
  await page.getByText("Route").first().waitFor();
  await shot(page, "app-02-pickup-prefilled");

  await page.goto("/");
  await page.getByText("Move it again").waitFor({ timeout: 60_000 });
  // The row's own subtitle: "Suggest a shop" alone also matches the button on
  // Home, which stays mounted behind the tab navigator.
  await openTab(page, "Profile", "Somewhere you'd like Wave to buy from");
  await page.getByText("Somewhere you'd like Wave to buy from").scrollIntoViewIfNeeded();
  await shot(page, "app-03-profile-suggest-row");

  // With Buy for me open, Home carries the shops rail and the suggest card.
  await setBuyForMe(false);
  try {
    // `/service-status` is served with `cache-control: max-age=30`, so a reload
    // straight after the switch still gets the old answer. Wait it out.
    await page.waitForTimeout(31_000);
    await page.goto("/");
    await page.getByText("Buy for me").first().waitFor({ timeout: 60_000 });
    await page.getByText("Can't find your shop?").scrollIntoViewIfNeeded();
    await shot(page, "app-04-home-suggest-card-after-launch");
  } finally {
    await setBuyForMe(true);
  }
});
