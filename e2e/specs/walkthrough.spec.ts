import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";
import { applyTheme } from "../fixtures/theme";
import { step } from "../fixtures/narrate";

/**
 * How Wave is used, as one story: a student sends a package, a rider claims it,
 * carries it and closes it with the student's code, a shop owner starts prep on
 * a food order, and an operator watches all of it from the dashboard.
 *
 * Chapters run in file order and share the demo order `…315` ("Phone left at
 * the library desk"), which `packages/db/scripts/seed-demo.ts` resets to
 * paid-and-waiting on every run. These chapters WRITE: they claim, advance and
 * deliver that order, accept shop order `…313`, and create one unpaid pickup
 * for Ama (its id is written to results/walkthrough-created.json for cleanup).
 *
 *   npx tsx --env-file=.env packages/db/scripts/seed-demo.ts   (from packages/db)
 *   npx playwright test -c e2e/playwright.walkthrough.config.ts
 *   node e2e/tools/walkthrough-video.mjs
 */
test.describe.configure({ mode: "serial" });

/** `THEME=light|dark` records the whole story in that mode (PLAN-THEMES.md). */
const THEME = process.env.THEME;
test.beforeEach(async ({ page }) => applyTheme(page, THEME));

const D = (n: number) => `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STORY_ORDER = D(315);
const SHOP_ORDER = D(313);

const visible = (page: Page, text: string | RegExp) => page.getByText(text).locator("visible=true").first();

async function boot(page: Page, role: RoleKey, anchor: RegExp): Promise<void> {
  await signIn(page, role);
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS[role].id);
  await page.goto("/");
  await expect(visible(page, anchor)).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(1200);
}

async function tab(page: Page, label: string): Promise<void> {
  await page.getByLabel(`${label} tab`).locator("visible=true").first().click();
  await page.waitForTimeout(1200);
}

/** Deep screens with no tap path from the current one (e.g. a notification's target). */
async function open(page: Page, name: string, params: object): Promise<void> {
  await page.evaluate(([n, p]) => (window as any).__waveNav.navigate(n, p), [name, params] as const);
  await page.waitForTimeout(1500);
}

async function scrollBy(page: Page, dy: number): Promise<void> {
  await page.mouse.move(195, 500);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(900);
}

// ── 1. Student ──────────────────────────────────────────────────────────────

test("@mobile 01 Ama, a student, sends a package across campus", async ({ page }) => {
  await boot(page, "student", /Send a package/);
  await step(page, "Meet Ama", "A student at Ashesi. Home shows the next Wave (Sunday), how long ordering stays open, and everything she has in flight.", 3200);
  await page.waitForTimeout(1500);
  await scrollBy(page, 420);
  await scrollBy(page, -420);

  await step(page, "Sending a package", "Ama needs a parcel carried from one campus checkpoint to another.");
  await page.getByRole("button", { name: /Send a package/ }).locator("visible=true").first().click();
  await expect(visible(page, "What are we moving?")).toBeVisible();

  await page.getByLabel(/^Collect from\./).locator("visible=true").first().click();
  await page.getByRole("dialog").getByRole("button", { name: /^Main Gate/ }).click();
  await page.getByLabel(/^Deliver to\./).locator("visible=true").first().click();
  await page.getByRole("dialog").getByRole("button", { name: /^Hostel Block A/ }).click();
  await page.getByPlaceholder(/Blue bag left/).locator("visible=true").first().pressSequentially("Box of books from home, taped shut", { delay: 35 });
  await page.waitForTimeout(1200);

  await step(page, "One flat fee", "The delivery fee is fixed and shown before she commits. Review creates the order and takes her to pay.");
  const created = page.waitForResponse((r) => r.url().includes("/v1/orders") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Review pickup" }).locator("visible=true").first().click();
  const order = await (await created).json().catch(() => null);
  writeFileSync(resolve(__dirname, "../results/walkthrough-created.json"), JSON.stringify({ orderId: order?.order?.id ?? order?.id ?? null }));
  await page.waitForTimeout(2500);
  await step(page, "Paying with Paystack", "Card or mobile money. Wave never trusts a price from the phone: the server recalculates every total. We stop here rather than charge a real account.", 3800);

  await step(page, "An order already paid", "Earlier Ama sent her phone from the Library Steps to Ashesi Quad. It is paid and waiting for a rider.");
  await boot(page, "student", /Send a package/);
  await tab(page, "Orders");
  await page.waitForTimeout(1500);
  await open(page, "OrderTracking", { orderId: STORY_ORDER });
  await page.waitForTimeout(2500);
});

// ── 2. Rider picks it up ────────────────────────────────────────────────────

test("@mobile 02 Kofi, a rider, claims the job and carries it", async ({ page }) => {
  await boot(page, "rider", /On this run|Available to claim/);
  await step(page, "Meet Kofi", "A verified Wave rider. He goes online, and the feed lists paid jobs on the next Wave with what each one pays.", 3200);
  await scrollBy(page, 500);

  await step(page, "Claiming a job", "He opens Ama's package and accepts it. Only one rider can win a job; a second tap gets a clear 'already taken'.");
  await open(page, "OrderDetail", { orderId: STORY_ORDER });
  await page.getByRole("button", { name: "Accept this order" }).locator("visible=true").first().click();
  await expect(visible(page, /I've picked it up|I'm at the checkpoint/)).toBeVisible();
  await page.waitForTimeout(2000);

  await step(page, "Collected", "At the Library Steps he collects the phone and marks it picked up. Ama's tracking moves with him.");
  await page.getByRole("button", { name: "I've picked it up" }).locator("visible=true").first().click();
  await expect(visible(page, "I'm at the checkpoint")).toBeVisible();
  await page.waitForTimeout(1800);

  await step(page, "At the checkpoint", "He reaches Ashesi Quad and says so. Now he needs Ama's 6-digit code to hand it over.");
  await page.getByRole("button", { name: "I'm at the checkpoint" }).locator("visible=true").first().click();
  await expect(visible(page, /PIN|code/i)).toBeVisible();
  await page.waitForTimeout(2000);
});

// ── 3. Student reads her code ───────────────────────────────────────────────

test("@mobile 03 Ama meets the rider and reads out her code", async ({ page }) => {
  await boot(page, "student", /Send a package/);
  await step(page, "Your rider is here", "Ama's order now says it is at the checkpoint. Her code was texted to her and is also in the app.");
  await open(page, "OrderTracking", { orderId: STORY_ORDER });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Show pickup code" }).locator("visible=true").first().click();
  await expect(visible(page, /\d\s*\d\s*\d\s*\d\s*\d\s*\d/)).toBeVisible();
  await page.waitForTimeout(3500);
});

// ── 4. Rider closes it ──────────────────────────────────────────────────────

test("@mobile 04 Kofi enters the code and the delivery closes", async ({ page }) => {
  await boot(page, "rider", /On this run|Available to claim/);
  await step(page, "Closing the delivery", "Kofi types the code Ama reads out. It is checked against a bcrypt hash on the server, and guessing is capped at five tries.");
  await open(page, "PinEntry", { orderId: STORY_ORDER });
  await page.getByLabel("6-digit delivery PIN").locator("visible=true").first().pressSequentially("615284", { delay: 180 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Confirm delivery" }).locator("visible=true").first().click();
  await page.waitForTimeout(3000);

  await step(page, "Getting paid", "Earnings shows what he is owed from this week and what has already been paid out.");
  await page.goto("/");
  await expect(visible(page, /On this run|Available to claim/)).toBeVisible({ timeout: 60_000 });
  await tab(page, "Earnings");
  await page.waitForTimeout(2500);
  await scrollBy(page, 400);
});

// ── 5. Student sees it done ─────────────────────────────────────────────────

test("@mobile 05 Ama sees it delivered", async ({ page }) => {
  await boot(page, "student", /Send a package/);
  await step(page, "Delivered", "The order closes for Ama too, and it counts toward her loyalty reward: 20% off one delivery fee in every six.");
  await open(page, "OrderTracking", { orderId: STORY_ORDER });
  await page.waitForTimeout(3000);
  await page.goto("/");
  await expect(visible(page, /Send a package/)).toBeVisible({ timeout: 60_000 });
  await tab(page, "Profile");
  await page.waitForTimeout(2500);
});

// ── 6. Shop owner ───────────────────────────────────────────────────────────

test("@mobile 06 A shop owner prepares a Buy for me order", async ({ page }) => {
  await boot(page, "shop", /Hello,|Orders today/);
  // The owner runs several shops and the dashboard opens on the first.
  const mamaPut = () => page.getByText("Mama Put Kitchen", { exact: true }).locator("visible=true").first().click();
  await mamaPut();
  await page.waitForTimeout(1500);
  await step(page, "Meet Mama Put Kitchen", "Once Buy for me launches, students order from shops like this one. The owner sees today's orders here.", 3200);
  await scrollBy(page, 400);
  await step(page, "Starting prep", "A new order for three plates of jollof. The owner confirms they will make it, so the rider knows it will be ready.");
  await open(page, "IncomingOrderDetail", { orderId: SHOP_ORDER });
  await page.getByRole("button", { name: "We'll start prep" }).locator("visible=true").first().click();
  await page.waitForTimeout(2500);
  await step(page, "The menu", "Prices live here, and the server uses them, never the phone. An item can be marked out of stock in one tap.");
  await page.goto("/");
  await expect(visible(page, /Hello,|Orders today/)).toBeVisible({ timeout: 60_000 });
  await tab(page, "Menu");
  await mamaPut();
  await page.waitForTimeout(2500);
});

// ── 7. Operator ─────────────────────────────────────────────────────────────

test("@admin 07 The Wave team runs it from the dashboard", async ({ page }) => {
  test.setTimeout(900_000);
  await signIn(page, "admin");
  const go = async (path: string) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.getByText("Loading…").first().waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);
  };
  await go("/dashboard");
  await step(page, "The operator's view", "Wave staff see today's orders, revenue and anything that needs a decision.", 3200);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1500);

  await step(page, "Every order, every step", "The order Kofi just delivered, with its full timeline: paid, claimed, collected, at the checkpoint, delivered.");
  await go(`/orders/${STORY_ORDER}`);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(1500);

  await step(page, "Riders", "New riders submit ID and a selfie. Staff approve them before they can see a single order.");
  await go("/riders");
  await step(page, "Refunds", "A campus admin raised a complaint about a missing plate. HQ decides, and Paystack refunds it.");
  await go("/refunds");
  await step(page, "What students want next", "Shops students have asked for, ranked by demand. This is who Wave signs up next.");
  await go("/suggestions");
  await step(page, "The switches", "Buy for me stays hidden until enough shops are signed up. One button opens it for every student.");
  await go("/config");
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(2000);
});
