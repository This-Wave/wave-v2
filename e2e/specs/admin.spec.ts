import { test, expect } from "../fixtures/harness";
import { signIn, signInExpiringSoon, tokenFor, API_URL } from "../fixtures/session";
import { ACCOUNTS } from "../fixtures/accounts";

/**
 * The admin dashboard, driven the way an operator would drive it: sign in on
 * the real login form, then walk every page in the sidebar and read what is
 * on it. Unlike apps/admin/e2e (which is deliberately signed-out only), this
 * runs against the live API and the live database.
 */

test.describe("admin — signed out", () => {
  test("the login form rejects a wrong password and never leaks the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("table")).toHaveCount(0);

    await page.getByLabel("Phone number").fill(ACCOUNTS.admin.phone);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/invalid|credential/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a real admin can sign in through the form", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Phone number").fill(ACCOUNTS.admin.phone);
    await page.getByLabel("Password").fill(ACCOUNTS.admin.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await expect(page.getByText("Platform Overview")).toBeVisible();
  });
});

test.describe("admin — signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "admin");
  });

  test("the dashboard reports the same totals the API does", async ({ page }) => {
    const token = await tokenFor("admin");
    const stats = await (
      await fetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
    ).json();

    await page.goto("/dashboard");
    await expect(page.getByText("Platform Overview")).toBeVisible({ timeout: 30_000 });

    // The tiles render an em dash until the fetch resolves, so wait for the
    // data rather than racing it.
    await expect(page.getByText("Active Riders")).toBeVisible();
    // Poll the tile itself, not the whole body — the orders table renders an
    // em dash of its own for orders with no shop.
    await expect
      .poll(
        async () =>
          /Active Riders[\s\S]{0,12}?\d/.test(await page.locator("body").innerText()),
        { timeout: 30_000, message: "the stat tiles resolve past their loading placeholder" },
      )
      .toBe(true);

    // The tiles must agree with the API, not merely be present. A tile stuck
    // on a hardcoded 0 renders identically to a correct one.
    const body = await page.locator("body").innerText();
    expect(body, "active riders tile").toContain(String(stats.activeRiders));
    expect(body, "pending verifications tile").toContain(String(stats.pendingRiders));

    // Recent orders must be real rows, not an empty table.
    await expect(page.locator("table tbody tr").first()).toBeVisible();
    expect(await page.locator("table tbody tr").count()).toBeGreaterThan(0);
  });

  const PAGES: Array<[string, RegExp]> = [
    ["/orders", /orders/i],
    ["/riders", /rider/i],
    ["/shops", /shops/i],
    ["/suggestions", /suggest/i],
    ["/users", /users/i],
    ["/checkpoints", /checkpoint/i],
    ["/config", /config/i],
  ];

  for (const [route, heading] of PAGES) {
    test(`${route} loads and renders its own content`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({ timeout: 30_000 });
      // Not a spinner that never resolved, and not an error banner.
      await expect(page.getByText(/failed to|could not load|something went wrong/i)).toHaveCount(0);
    });
  }

  test("an order opens to its detail page", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 30_000 });
    // Click the row *body*, not the link in the first cell — the whole row is
    // the click target now, which it was not before 2026-08-28.
    await page.locator("table tbody tr").first().locator("td").nth(3).click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await expect(page.getByText(/GHS|GH₵/).first()).toBeVisible();
  });

  test("config rejects a value outside its allowed bounds", async ({ page }) => {
    // PUT /admin/config gained per-key bounds on 2026-08-25; the page had no
    // catch at all before that, so a rejected save looked like a successful one.
    await page.goto("/config");
    await expect(page.getByRole("heading", { name: /config/i }).first()).toBeVisible({ timeout: 30_000 });
    // The form renders empty and is seeded from the fetch, so wait for a real
    // value before typing.
    const field = page.locator("#delivery_fee_base");
    await expect(field).toBeVisible({ timeout: 30_000 });
    await expect(field).toHaveValue(/\d/, { timeout: 30_000 });
    const original = await field.inputValue();

    const save = page.getByRole("button", { name: /save/i }).first();
    await field.fill("999999");
    await expect(field).toHaveValue("999999");
    // Save only enables once the page considers the form dirty.
    await expect(save).toBeEnabled();
    await save.click();

    // The save must be refused *and say so*. Before 2026-08-25 the page had no
    // catch at all, so a rejected save looked exactly like a successful one.
    // Scoped to the page's own alert: Next renders a permanent route-announcer
    // that also carries role="alert", so a bare selector is a strict-mode
    // violation waiting to happen.
    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 20_000 });

    // And the absurd value must not have reached the database.
    const token = await tokenFor("admin");
    const config = await (
      await fetch(`${API_URL}/admin/config`, { headers: { Authorization: `Bearer ${token}` } })
    ).json();
    const rows = config.config ?? config;
    const saved = (Array.isArray(rows) ? rows : []).find(
      (r: { key: string }) => r.key === "delivery_fee_base",
    );
    expect(Number(saved?.value ?? original), "the rejected value was not persisted").not.toBe(999999);

    await field.fill(original);
  });
});

/**
 * Regressions from the 2026-08-27 E2E run. Both bugs came from the same place:
 * `AdminAuthProvider` handing out a new `accessToken` identity for a session
 * the app had already applied, which re-fired every `useCallback([accessToken])`
 * loader in the dashboard.
 */
test.describe("admin — regressions", () => {
  test("an unsaved config edit survives a token refresh", async ({ page }) => {
    // The original bug: the refresh re-fired the config fetch, whose .then
    // re-seeded the form and silently threw away what the admin had typed.
    await signInExpiringSoon(page, "admin");

    let refreshed = false;
    page.on("request", (request) => {
      if (request.url().includes("grant_type=refresh_token")) refreshed = true;
    });

    await page.goto("/config");
    const field = page.locator("#delivery_fee_base");
    await expect(field).toBeVisible({ timeout: 30_000 });
    await expect(field).toHaveValue(/\d/, { timeout: 30_000 });

    await field.fill("999999");
    await expect(field).toHaveValue("999999");

    // Wait for the refresh actually to happen — otherwise this test passes by
    // never exercising the thing it is named after.
    await expect
      .poll(() => refreshed, { timeout: 90_000, message: "supabase refreshes the token" })
      .toBe(true);

    // Give the re-fired fetch time to land and do its damage, if it still can.
    await page.waitForTimeout(4_000);
    await expect(field, "the edit survived the refresh").toHaveValue("999999");
    await expect(page.getByRole("button", { name: /save/i }).first()).toBeEnabled();
  });

  test("the profile is fetched once per page load, not twice", async ({ page }) => {
    // `getSession()` and onAuthStateChange's INITIAL_SESSION both deliver the
    // same session; applying it twice doubled every fetch in the app.
    //
    // Only /profile/me is asserted. Each page's *own* loader legitimately runs
    // twice under `reactStrictMode`, which this dev server has on and which
    // production does not — asserting that here would fail for a reason that
    // is not a bug. /profile/me is the auth provider's own call, and the fix
    // dedupes it even when StrictMode double-invokes the effect.
    await signIn(page, "admin");

    const calls = new Map<string, number>();
    page.on("request", (request) => {
      const url = request.url();
      if (!url.includes("/v1/")) return;
      const path = url.split("/v1")[1].split("?")[0];
      calls.set(path, (calls.get(path) ?? 0) + 1);
    });

    await page.goto("/orders");
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3_000);

    expect(calls.get("/profile/me"), "the profile is fetched once per page load").toBe(1);
  });
});
