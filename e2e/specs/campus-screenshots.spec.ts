import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { signIn } from "../fixtures/session";

/**
 * Stills of university (campus) admins and HQ-approved refunds.
 *
 * Expects the state the campus probe leaves: the seed rider (Kofi) is the
 * Ashesi campus admin, Ashesi pickup is paused by him, one refund request is
 * pending, and a test campus "University of Ghana (test)" exists with one order.
 *   npx playwright test -c e2e/playwright.shots.config.ts campus-screenshots
 */
const ROOT = resolve(__dirname, "../../screenshots/campus-admins");
mkdirSync(ROOT, { recursive: true });
const ASHESI_ORDER = "00000000-0000-0000-0000-000000000500";

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(ROOT, `${name}.png`), fullPage });
}

test("@admin HQ side", async ({ page }) => {
  await signIn(page, "admin");

  await page.goto("/campus-admins");
  await page.getByText("Kofi Boateng").first().waitFor();
  await shot(page, "hq-01-campus-admins", true);
  await page.getByRole("button", { name: "Add campus admin" }).click();
  await page.getByPlaceholder("024 123 4567").fill("020 123 4567");
  await shot(page, "hq-02-add-campus-admin");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.goto("/refunds");
  await page.getByText("Student says half the order").first().waitFor();
  await shot(page, "hq-03-refund-requests-queue");
  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "hq-04-approve-refund-dialog");
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("@admin campus admin side", async ({ page }) => {
  // Kofi's account: the seed rider, now the Ashesi campus admin.
  await signIn(page, "rider");

  await page.goto("/dashboard");
  await page.getByText("Campus admin · Ashesi University").waitFor();
  await page.getByText("Today at your campus").waitFor();
  await page.getByText("Loading…").first().waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "campus-05-dashboard-and-sidebar");

  await page.goto("/orders");
  await page.getByRole("heading", { name: "Orders" }).waitFor();
  await page.waitForTimeout(1200);
  await shot(page, "campus-06-orders-own-campus-only");

  await page.goto(`/orders/${ASHESI_ORDER}`);
  await page.getByText("waiting for HQ").waitFor();
  await shot(page, "campus-07-order-refund-waiting-for-hq");

  await page.goto("/config");
  await page.getByText("Students see:").waitFor();
  await shot(page, "campus-08-pause-own-campus");

  await page.goto("/refunds");
  await page.getByText("Student says half the order").first().waitFor();
  await shot(page, "campus-09-refund-requests-read-only");

  await page.goto("/audit");
  await page.getByText(/Everything that happens at/).waitFor();
  await page.waitForTimeout(1200);
  await shot(page, "campus-10-activity-log-campus-scope");
});
