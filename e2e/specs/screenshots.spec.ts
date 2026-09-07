import { mkdirSync, appendFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { signIn } from "../fixtures/session";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";

/**
 * Screen capture for the UX/accessibility pass — a visual record of every
 * screen we can reach without changing anything.
 *
 * Run it once at the pre-pass commit into `screenshots/before-ui-laws/`, then
 * again once the plan is complete into `screenshots/after-ui-laws/`, and the
 * two folders diff screen for screen.
 *
 * Two rules shape this file:
 *
 * 1. **It never writes.** No order is placed, no profile saved, no shop
 *    approved. The runs point at the real API and the real Neon database, and a
 *    screenshot run that leaves rows behind is a screenshot run nobody will be
 *    willing to repeat. Every journey stops one click short of the button that
 *    commits.
 * 2. **One unreachable screen must not cost the other forty.** `shot()` swallows
 *    its own failure and records it, so a capture run always produces a full set
 *    plus a manifest saying which frames are missing and why. A test that dies
 *    on screen three tells you nothing about screens four onward.
 */

const SHOT_DIR = process.env.SHOT_DIR ?? "before-ui-laws";
const ROOT = resolve(__dirname, "../../screenshots", SHOT_DIR);
// One manifest per Playwright project. The projects run in separate worker
// processes, so a single shared file meant whichever started second truncated
// the other's rows — the first run silently lost every admin line.
const manifestFor = (project: string) => resolve(ROOT, `manifest-${project}.md`);

mkdirSync(ROOT, { recursive: true });

const started = new Set<string>();

function record(project: string, line: string): void {
  const file = manifestFor(project);
  if (!started.has(project)) {
    writeFileSync(
      file,
      `# Screenshot run — \`${SHOT_DIR}\` · ${project}\n\n` +
        `Captured ${new Date().toISOString()} · commit \`${process.env.SHOT_COMMIT ?? "unknown"}\`\n\n` +
        `| # | Screen | Status |\n|---|---|---|\n`,
    );
    started.add(project);
  }
  appendFileSync(file, line + "\n");
}

let counter = 0;

/**
 * Navigate, then capture. `reach` does whatever it takes to get to the screen;
 * if it throws, the frame is skipped and the reason lands in the manifest
 * rather than ending the test.
 */
async function shot(
  page: Page,
  role: string,
  name: string,
  reach: () => Promise<void>,
): Promise<boolean> {
  counter += 1;
  const index = String(counter).padStart(2, "0");
  const project = test.info().project.name;
  const file = `${role}-${index}-${name}.png`;
  try {
    await reach();
    // Expo's navigator cross-fades; without this the frame catches a screen
    // mid-transition and the capture is a blur of two screens.
    await page.waitForTimeout(700);
    await page.screenshot({ path: resolve(ROOT, file), fullPage: true });
    record(project, `| ${index} | ${role} — ${name} | captured |`);
    return true;
  } catch (error) {
    const why = String(error).split("\n")[0].slice(0, 110);
    record(project, `| ${index} | ${role} — ${name} | **not reached** — ${why} |`);
    // Leave the run on a known screen so the next step starts from somewhere
    // predictable rather than wherever the failure stranded it.
    await page.goto("/").catch(() => {});
    await page.waitForTimeout(1200);
    return false;
  }
}

/**
 * Skip the first-run tour.
 *
 * It renders as a sheet over the whole app and swallows every click behind it,
 * so without this the first capture run reached exactly one screen and timed
 * out on the other twenty. `lib/onboarding.ts` keys the flag by profile id —
 * one campus phone gets shared, and a rider must not inherit a student's
 * "already seen" — so the id has to match the account being signed in.
 * AsyncStorage is plain localStorage on web.
 */
async function skipTour(page: Page, role: RoleKey): Promise<void> {
  const { id } = ACCOUNTS[role];
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    // The PWA install hint is the second overlay that eats clicks, and it is
    // nastier than the tour because it appears on a *delay* — the first three
    // captures of a run succeed and then the fourth times out, which reads like
    // a flaky selector rather than a card that slid over the tab bar.
    // (Worth noting as a real finding: it covers the bottom tab bar.)
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, id);
}

/**
 * Tap a bottom tab by its accessible name — which is the tab's *label*, not its
 * route name. They differ: rider `MyOrders` is labelled "Deliveries", shop
 * `Dashboard` is labelled "Today".
 */
async function tab(page: Page, label: string): Promise<void> {
  await page.getByLabel(`${label} tab`).first().click();
}

/** Back out of a pushed screen to the tab underneath it. */
async function backToHome(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------
// Student — the flow that has to work for Wave to have a product
// ---------------------------------------------------------------------------

test("@mobile student screens", async ({ page }) => {
  await signIn(page, "student");
  await skipTour(page, "student");
  await bootMobile(page, /Mama Put Kitchen|Wave/);

  await shot(page, "student", "home", async () => {
    await expect(onScreen(page, "Mama Put Kitchen")).toBeVisible();
  });

  // Category chips came off Home in the redesign — filtering belongs on the
  // browse screen, not before you have reached a single shop.
  await shot(page, "student", "home-pickup-tab", async () => {
    await page.getByRole("tab", { name: "Pickup" }).click();
    await expect(onScreen(page, /Move a package/i)).toBeVisible();
  });

  await shot(page, "student", "wave-calendar", async () => {
    await backToHome(page);
    await page.getByText(/Arriving (Sunday|Wednesday)/i).first().click();
    await expect(onScreen(page, /Wave|calendar|Choose/i)).toBeVisible();
  });

  await shot(page, "student", "shop-selection", async () => {
    await backToHome(page);
    await page.getByText(/Search|What do you need|shops/i).first().click();
    await expect(onScreen(page, "Mama Put Kitchen")).toBeVisible();
  });

  await shot(page, "student", "pickup-request", async () => {
    // Home resets to the Buy tab whenever it remounts, so this has to select
    // Pickup again rather than assume the earlier step left it there.
    await backToHome(page);
    await page.getByRole("tab", { name: "Pickup" }).click();
    await page.getByRole("button", { name: "Start a pickup" }).click();
    await expect(onScreen(page, /What are we moving|Route/i)).toBeVisible();
  });

  await shot(page, "student", "shop-menu", async () => {
    await backToHome(page);
    await page.getByText("Mama Put Kitchen").first().click();
    await expect(page.getByText(/STEP 1 OF 3/i)).toBeVisible();
  });

  await shot(page, "student", "shop-menu-item-added", async () => {
    await page.getByLabel(/^Add /).first().click();
    await expect(onScreen(page, /1 item/i)).toBeVisible();
  });

  // Menu now leads straight here: the old Details screen asked one question it
  // had already answered, and this screen repeated its answers back.
  // Stops at the review. The next control commits a real order.
  await shot(page, "student", "review-merged", async () => {
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByText(/STEP 2 OF 3/i)).toBeVisible();
    await expect(onScreen(page, "What you pay")).toBeVisible();
  });

  await shot(page, "student", "orders-tab", async () => {
    await backToHome(page);
    await tab(page, "Orders");
    await page.waitForTimeout(1200);
  });

  await shot(page, "student", "checkpoints-tab", async () => {
    await tab(page, "Checkpoints");
    await page.waitForTimeout(1200);
  });

  await shot(page, "student", "profile-tab", async () => {
    await tab(page, "Profile");
    await page.waitForTimeout(1200);
  });
});

// ---------------------------------------------------------------------------
// Rider and shop owner — still on the deprecated v5 primitives
// ---------------------------------------------------------------------------

test("@mobile rider screens", async ({ page }) => {
  await signIn(page, "rider");
  await skipTour(page, "rider");
  await bootMobile(page, /Feed|Deliver|order|Wave/i);

  await shot(page, "rider", "feed", async () => {
    await tab(page, "Feed");
    await page.waitForTimeout(1200);
  });

  await shot(page, "rider", "feed-order-detail", async () => {
    await page.getByText(/GH₵/).first().click();
    await page.waitForTimeout(1200);
  });

  await shot(page, "rider", "my-orders", async () => {
    await backToHome(page);
    await tab(page, "Deliveries");
    await page.waitForTimeout(1200);
  });

  await shot(page, "rider", "earnings", async () => {
    await tab(page, "Earnings");
    await page.waitForTimeout(1200);
  });

  await shot(page, "rider", "profile", async () => {
    await tab(page, "Profile");
    await page.waitForTimeout(1200);
  });
});

test("@mobile shop owner screens", async ({ page }) => {
  await signIn(page, "shop");
  await skipTour(page, "shop");
  await bootMobile(page, /Dashboard|Orders|Menu|Wave/i);

  await shot(page, "shop", "dashboard", async () => {
    await tab(page, "Today");
    await page.waitForTimeout(1200);
  });

  await shot(page, "shop", "orders", async () => {
    await tab(page, "Orders");
    await page.waitForTimeout(1200);
  });

  await shot(page, "shop", "menu", async () => {
    await tab(page, "Menu");
    await page.waitForTimeout(1200);
  });

  await shot(page, "shop", "settings", async () => {
    await tab(page, "Settings");
    await page.waitForTimeout(1200);
  });
});

// ---------------------------------------------------------------------------
// Admin — the surface with no keyboard story at all before this pass
// ---------------------------------------------------------------------------

test("@admin dashboard screens", async ({ page }) => {
  // The login screen is the one admin page worth capturing signed out.
  await shot(page, "admin", "login", async () => {
    await page.goto("/login");
    await expect(page.getByRole("button").first()).toBeVisible();
  });

  await signIn(page, "admin");

  const pages: [string, string, RegExp][] = [
    ["dashboard", "/dashboard", /Dashboard|Orders|Riders/i],
    ["orders", "/orders", /Order|Status/i],
    ["riders", "/riders", /Rider|Verification/i],
    ["shops", "/shops", /Shop/i],
    ["suggestions", "/suggestions", /Suggest/i],
    ["users", "/users", /User|Role/i],
    ["checkpoints", "/checkpoints", /Checkpoint/i],
    ["config", "/config", /Config|Fee|Delivery/i],
  ];

  for (const [name, path, anchor] of pages) {
    await shot(page, "admin", name, async () => {
      await page.goto(path);
      // Wait for the page's own fetches to settle before asserting on content.
      // Asserting straight after goto made this flaky: the frame that failed
      // moved between runs, so the manifest and the files on disk disagreed.
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page.getByText(anchor).first()).toBeVisible({ timeout: 25_000 });
      // Tables paint after their fetch resolves. A fixed timeout caught the
      // literal string "Loading…" in the first run, so wait on the thing that
      // actually signals readiness.
      await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 20_000 });
    });
  }

  await shot(page, "admin", "order-detail", async () => {
    await page.goto("/orders");
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 20_000 });
    // Every row links to its order; take the first one rather than guessing at
    // a reference format.
    await page.locator("tbody tr a, tbody tr").first().click();
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 20_000 });
  });

  // A dialog is where the focus-trap and focus-ring work lands, so it earns a
  // frame of its own. Opening one is read-only; nothing is submitted.
  await shot(page, "admin", "checkpoints-create-modal", async () => {
    await page.goto("/checkpoints");
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 20_000 });
    await page.getByRole("button", { name: /new|add|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  await shot(page, "admin", "modal-focus-state", async () => {
    // Tab once so the frame shows what keyboard focus actually looks like —
    // the single most useful before/after comparison on this surface.
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);
  });
});
