import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { API_URL, mintSession, signIn } from "../fixtures/session";

/**
 * Stills of the staff roles / service switches / beta / activity log work
 * (branch feature/staff-roles-audit-beta), for a human to look at.
 *
 * Expects the state the live API probe leaves behind: Buy for me paused with a
 * message, the student an approved beta tester with one piece of feedback, and
 * group orders set to "Beta testers". Run with:
 *   npx playwright test -c e2e/playwright.shots.config.ts control-screenshots
 */
const ROOT = resolve(__dirname, "../../screenshots/control-panel");
mkdirSync(ROOT, { recursive: true });

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(ROOT, `${name}.png`), fullPage });
}

async function skipOverlays(page: Page, role: RoleKey): Promise<void> {
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS[role].id);
}

async function api(role: RoleKey, method: string, path: string, body?: unknown) {
  const session = await mintSession(role);
  return fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token as string}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("@admin control panel", async ({ page }) => {
  await signIn(page, "admin");

  await page.goto("/dashboard");
  await page.getByText("Activity log").first().waitFor();
  await shot(page, "admin-01-sidebar-control-group");

  await page.goto("/staff");
  await page.getByRole("heading", { name: "What each role can do" }).waitFor();
  await shot(page, "admin-02-staff", true);
  await page.getByRole("button", { name: "Add staff" }).click();
  await page.getByPlaceholder("024 123 4567").fill("055 123 4567");
  await shot(page, "admin-03-add-staff-modal");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.goto("/config");
  await page.getByText("Students see:").waitFor();
  await shot(page, "admin-04-ordering-switches");
  await page.getByRole("button", { name: "Pause" }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.locator("textarea").first().fill("Rider shortage this evening — pickups resume tomorrow.");
  await shot(page, "admin-05-pause-dialog");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("heading", { name: "Features" }).scrollIntoViewIfNeeded();
  await shot(page, "admin-06-feature-flags-three-state");

  await page.goto("/beta");
  await page.getByRole("button", { name: /^Testers/ }).click();
  await page.getByText("Ama Owusu").first().waitFor();
  await shot(page, "admin-07-beta-testers", true);

  await page.goto("/audit");
  await page.getByText("Switch paused").first().waitFor();
  await page.getByRole("button", { name: "Live" }).waitFor({ timeout: 20_000 });
  // Something happens while the page is open, so the live stream is visible.
  await api("student", "POST", "/beta/feedback", { message: "Live-stream check from the screenshot run.", screen: "Profile" });
  await page.getByText("Beta feedback sent").first().waitFor();
  await page.waitForTimeout(300);
  await shot(page, "admin-08-activity-log-live");

  await page.getByRole("button", { name: /Switch paused/ }).first().click();
  await shot(page, "admin-09-activity-log-row-detail");

  await page.getByLabel("Area").selectOption("security");
  await page.getByText("Security forbidden").first().waitFor();
  await shot(page, "admin-10-activity-log-filtered-refusals");
});

test("@mobile student and rider", async ({ page, context }) => {
  await signIn(page, "student");
  await skipOverlays(page, "student");
  await page.goto("/");
  await page.getByText("Buy for me is paused").waitFor({ timeout: 60_000 });
  await shot(page, "app-11-student-home-paused");

  await page.getByLabel("Profile tab").first().click();
  await page.getByText("Send beta feedback").waitFor();
  await page.getByText("Send beta feedback").scrollIntoViewIfNeeded();
  await shot(page, "app-12-student-profile-beta-tester");
  await page.getByText("Send beta feedback").click();
  await page.getByText("What happened, or what would make it better?").waitFor();
  await page.locator("textarea").last().fill("The pause message was clear — I knew when to come back.");
  await shot(page, "app-13-beta-feedback-sheet");

  await context.clearCookies();
  const rider = await context.newPage();
  await signIn(rider, "rider");
  await skipOverlays(rider, "rider");
  await rider.goto("/");
  await rider.getByLabel("Profile tab").first().click({ timeout: 60_000 });
  await rider.getByText("Join the beta").waitFor();
  await rider.getByText("Join the beta").scrollIntoViewIfNeeded();
  await shot(rider, "app-14-rider-profile-join-beta");
  await rider.getByText("Join the beta").click();
  await rider.getByText("Join the Wave beta").waitFor();
  await shot(rider, "app-15-rider-apply-sheet");
});
