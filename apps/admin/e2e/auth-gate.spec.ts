import { expect, test } from "@playwright/test";

/**
 * The admin auth gate (review 02-qa-engineer, H2).
 *
 * Everything behind `(app)/` is admin-only and reachable by URL, so the
 * property that matters is that a signed-out visitor never sees admin data —
 * not merely that they eventually get bounced. A redirect that renders the
 * dashboard for a frame first has already leaked it.
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/orders",
  "/riders",
  "/shops",
  "/users",
  "/checkpoints",
  "/config",
  "/suggestions",
];

test.describe("signed out", () => {
  test("the root redirects to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("no admin data is rendered on the way to the redirect", async ({ page }) => {
    // The gate renders a "Loading…" placeholder until auth resolves, then
    // redirects. The sidebar and any table must never appear.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });
});

test.describe("login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders the sign-in form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Phone number")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("masks the password field", async ({ page }) => {
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  });

  test("will not submit an empty form", async ({ page }) => {
    // Both inputs are `required`, so the browser blocks submission and we stay
    // put — no request, no navigation.
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("will not submit with a phone but no password", async ({ page }) => {
    await page.getByLabel("Phone number").fill("+233241234567");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("uses autocomplete hints a password manager can act on", async ({ page }) => {
    await expect(page.getByLabel("Phone number")).toHaveAttribute("autocomplete", "username");
    await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
  });
});
