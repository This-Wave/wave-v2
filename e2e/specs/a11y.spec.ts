import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect, bootMobile, onScreen } from "../fixtures/harness";
import { signIn } from "../fixtures/session";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";

/**
 * Automated WCAG 2.2 AA scan of every screen the capture run can reach.
 *
 * **What this is not.** axe finds roughly a third to a half of WCAG issues, and
 * only the mechanical part: contrast it can compute, names it can find missing,
 * roles it can see misused. It cannot tell you that a label is accurate, that a
 * reading order makes sense, or that a live region fires at a useful moment.
 * The screen-reader traversal in `docs/accessibility-device-checks.md` is what
 * covers those, and nothing here substitutes for it.
 *
 * **What it is.** A floor that cannot silently drop. Every violation below was
 * fixed rather than baselined, so the assertion is zero — if a future change
 * reintroduces a 1.8:1 placeholder or an unlabelled button, this fails.
 *
 * The mobile app runs through React Native Web, so its DOM is a deep tree of
 * generic divs with ARIA attributes rather than semantic HTML. Rules that
 * assume hand-written markup (`region`, `page-has-heading-one`, landmark rules)
 * report the framework's structure rather than anything a developer here chose,
 * so they are disabled for the mobile project only. Admin is real Next.js
 * markup and is held to the full set.
 */

const REPORT_DIR = resolve(__dirname, "../results/a11y");
mkdirSync(REPORT_DIR, { recursive: true });

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Rules that describe React Native Web's DOM, not our code. */
const RNW_NOISE = [
  "region",
  "page-has-heading-one",
  "landmark-one-main",
  "landmark-unique",
  "html-has-lang",
  "document-title",
  "bypass",
];

type AxeNode = { target: unknown[]; html: string; failureSummary?: string };
type Violation = { id: string; impact?: string | null; nodes: AxeNode[]; help: string };

async function scan(page: Page, name: string, disable: string[] = []): Promise<Violation[]> {
  // Let the navigator's cross-fade finish. Scanning mid-transition reads the
  // animated opacity as the element's real colour: the first run of this file
  // reported seven contrast failures at #818181, which is #6a6a6a — a passing
  // 5.41:1 — rendered at about 85% through a fade. Same class of error as a
  // screenshot catching two screens at once.
  await page.waitForTimeout(900);

  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    .disableRules(disable)
    .analyze();

  const violations = results.violations as unknown as Violation[];
  writeFileSync(
    resolve(REPORT_DIR, `${name}.json`),
    JSON.stringify(
      violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        count: v.nodes.length,
        // The element and axe's own explanation of the measurement. A bare
        // count tells you a page is failing and nothing about where, which
        // makes the report unusable for the person who has to fix it.
        nodes: v.nodes.map((n) => ({
          target: n.target,
          html: n.html.slice(0, 240),
          why: n.failureSummary,
        })),
      })),
      null,
      2,
    ),
  );
  return violations;
}

function describe(violations: Violation[]): string {
  return violations
    .map((v) => `${v.id} (${v.impact}, ${v.nodes.length}×): ${v.help}`)
    .join("\n");
}

async function skipOverlays(page: Page, role: RoleKey): Promise<void> {
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS[role].id);
}

// ---------------------------------------------------------------------------

test("@admin admin pages are clean under axe", async ({ page }) => {
  await signIn(page, "admin");

  const pages = [
    ["dashboard", "/dashboard"],
    ["orders", "/orders"],
    ["riders", "/riders"],
    ["shops", "/shops"],
    ["suggestions", "/suggestions"],
    ["users", "/users"],
    ["checkpoints", "/checkpoints"],
    ["config", "/config"],
  ] as const;

  const failures: string[] = [];

  for (const [name, path] of pages) {
    await page.goto(path);
    await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 20_000 });
    const violations = await scan(page, `admin-${name}`);
    if (violations.length) failures.push(`── ${path}\n${describe(violations)}`);
  }

  expect(failures.join("\n\n"), "axe violations on admin").toBe("");
});

test("@admin the create-checkpoint dialog is clean under axe", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/checkpoints");
  await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole("button", { name: /new|add|create/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const violations = await scan(page, "admin-dialog");
  expect(describe(violations), "axe violations in the dialog").toBe("");
});

test("@mobile student screens are clean under axe", async ({ page }) => {
  await signIn(page, "student");
  await skipOverlays(page, "student");
  await bootMobile(page, /Mama Put Kitchen|Wave/);

  const failures: string[] = [];

  const home = await scan(page, "mobile-student-home", RNW_NOISE);
  if (home.length) failures.push(`── home\n${describe(home)}`);

  // Into the funnel: the menu, then the money.
  await page.getByRole("button", { name: /Mama Put Kitchen/ }).first().click();
  await expect(page.getByText(/STEP 1 OF 3/i)).toBeVisible();
  const menu = await scan(page, "mobile-student-menu", RNW_NOISE);
  if (menu.length) failures.push(`── shop menu\n${describe(menu)}`);

  await page.getByLabel(/^Add /).first().click();
  // Wait for the basket to register before moving on. Without this the
  // Continue tap can land before the item does, and the summary renders a
  // different screen than the one this test means to scan.
  await expect(onScreen(page, /1 item/i)).toBeVisible();
  // By role, not by text. The text node sits inside the Pressable, and a click
  // on it does not always reach the handler — the run that found this was
  // stranded on step 2 with the button right there in the snapshot.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/STEP 2 OF 3/i)).toBeVisible();
  // Choose the checkpoint explicitly rather than trusting whatever the screen
  // defaults to once its list resolves. Clicking "Review order" the instant
  // step 2 rendered left the run stranded there: the button was present and
  // pressable, but the selection it depends on had not landed yet.
  await page.getByRole("button", { name: /Ashesi Quad/ }).first().click();
  await page.getByRole("button", { name: "Review order" }).click();
  // React Navigation keeps the previous screen mounted, so an unfiltered
  // getByText can resolve to a stale invisible copy — or, here, to none at all.
  await expect(onScreen(page, "What you pay")).toBeVisible();
  const summary = await scan(page, "mobile-student-summary", RNW_NOISE);
  if (summary.length) failures.push(`── order summary\n${describe(summary)}`);

  expect(failures.join("\n\n"), "axe violations on the student flow").toBe("");
});

test("@mobile rider and shop screens are clean under axe", async ({ page }) => {
  const failures: string[] = [];

  for (const role of ["rider", "shop"] as const) {
    await signIn(page, role);
    await skipOverlays(page, role);
    await bootMobile(page, /Wave|Available|Today|Orders|Feed/i);
    const violations = await scan(page, `mobile-${role}-landing`, RNW_NOISE);
    if (violations.length) failures.push(`── ${role}\n${describe(violations)}`);
  }

  expect(failures.join("\n\n"), "axe violations on rider and shop").toBe("");
});
