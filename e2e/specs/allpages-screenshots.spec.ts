import { test, type Page, type Route } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS, type RoleKey } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";
import { applyTheme } from "../fixtures/theme";

/**
 * Every screen in the app and the admin dashboard, in its empty and its full
 * state, filed by role:
 *
 *   screenshots/all-pages/<role>/NN-<screen>-<state>.png
 *
 * "Full" is the real API over the demo data from
 * `packages/db/scripts/seed-demo.ts` — run that first. "Empty" is the same API
 * with its list endpoints emptied in flight (arrays to [], counts to 0), which
 * is exactly what a brand-new account or campus receives, without deleting
 * anything to get there.
 *
 * The web build has no URL linking, so deep screens are opened through the
 * dev-only `window.__waveNav` handle (apps/mobile/src/lib/navigationRef.ts)
 * with real order ids from the demo seed.
 *
 * Buy for me is captured in both its states, one run each, flipping the
 * switch in between:
 *   BFM=closed npx playwright test -c e2e/playwright.shots.config.ts allpages
 *   BFM=open   npx playwright test -c e2e/playwright.shots.config.ts allpages
 * `node e2e/tools/allpages-index.mjs` then writes index.md and index.html.
 *
 * Nothing here writes. The only mutating control pressed is "Add" on a menu
 * item, which lives in the client's basket.
 */
const BFM = process.env.BFM ?? "closed";
const ROOT = process.env.SHOT_ROOT ?? resolve(__dirname, "../../screenshots/all-pages");
const MANIFEST = resolve(ROOT, "manifest.jsonl");

const D = (n: number) => `de000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CP = { hostelA: "00000000-0000-0000-0000-000000000102", library: "00000000-0000-0000-0000-000000000104" };
const MAMA_PUT = "00000000-0000-0000-0000-000000000301";

/**
 * `THEME=light|dark` renders every screen in that mode (PLAN-THEMES.md) by
 * seeding the storage key both apps read on boot. Unset, the apps follow the
 * system (light here).
 */
const THEME = process.env.THEME;
test.beforeEach(async ({ page }) => applyTheme(page, THEME));

// An interceptor still fetching when a test ends throws "Test ended" and fails
// a test whose screenshot was already taken. Drop them quietly first.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

// Mouse engine: the tab bar ignores synthesized presses under touch emulation.
test.use({
  hasTouch: false,
  isMobile: false,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
});

type State = "empty" | "full" | "default";

// ── Capture ─────────────────────────────────────────────────────────────────

/** API requests in flight per page. The dev Neon branch can take ~10s to answer. */
const inflight = new WeakMap<Page, Set<unknown>>();

function trackApi(page: Page): void {
  if (inflight.has(page)) return;
  const open = new Set<unknown>();
  inflight.set(page, open);
  // The activity log's live stream never finishes, so it is not counted.
  const counted = (url: string) => url.includes(":4010/") && !url.includes("/stream");
  page.on("request", (r) => counted(r.url()) && open.add(r));
  page.on("requestfinished", (r) => open.delete(r));
  page.on("requestfailed", (r) => open.delete(r));
}

/** Waits until no API call has been in flight for a moment, up to 30s. */
async function apiIdle(page: Page): Promise<void> {
  const open = inflight.get(page);
  if (!open) return;
  const deadline = Date.now() + 30_000;
  let quietSince = 0;
  while (Date.now() < deadline) {
    if (open.size === 0) {
      quietSince ||= Date.now();
      if (Date.now() - quietSince > 700) return;
    } else quietSince = 0;
    await page.waitForTimeout(100);
  }
}

async function settle(page: Page, ms = 900): Promise<void> {
  trackApi(page);
  await page.waitForTimeout(300);
  await apiIdle(page);
  await page
    .getByText(/^Loading/)
    .locator("visible=true")
    .first()
    .waitFor({ state: "detached", timeout: 8_000 })
    .catch(() => {});
  await page.waitForTimeout(ms);
}

async function capture(
  page: Page,
  role: string,
  n: number,
  screen: string,
  state: State,
  reach: () => Promise<void>,
  note = "",
): Promise<void> {
  const dir = resolve(ROOT, role);
  mkdirSync(dir, { recursive: true });
  const file = `${String(n).padStart(2, "0")}-${screen}${state === "default" ? "" : `-${state}`}.png`;
  const row = { role, n, screen, state, file: `${role}/${file}`, note, ok: true, why: "" };
  try {
    await reach();
    await settle(page);
    await page.screenshot({ path: resolve(dir, file) });
  } catch (error) {
    row.ok = false;
    row.why = String(error).split("\n")[0].slice(0, 160);
  }
  appendFileSync(MANIFEST, JSON.stringify(row) + "\n");
}

// ── Empty states ────────────────────────────────────────────────────────────

/** A response with every list emptied and every count zeroed. */
function blank(value: unknown): unknown {
  if (Array.isArray(value)) return [];
  if (typeof value === "number") return 0;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blank(v)]));
  }
  return value;
}

async function emptyOut(page: Page, pattern: RegExp): Promise<void> {
  await page.route(pattern, async (route: Route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch().catch(() => null);
    // Null when the test ended mid-request; nothing is left to answer.
    if (!response) return;
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return route.fulfill({ response }).catch(() => {});
    }
    return route.fulfill({ response, json: blank(body) }).catch(() => {});
  });
}

/** Rewrites one JSON response in flight. */
async function rewrite(page: Page, pattern: RegExp, edit: (body: any) => unknown): Promise<void> {
  await page.route(pattern, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch().catch(() => null);
    if (!response) return;
    return route.fulfill({ response, json: edit(await response.json()) }).catch(() => {});
  });
}

// ── Mobile navigation ───────────────────────────────────────────────────────

async function boot(page: Page, role: RoleKey | null): Promise<void> {
  trackApi(page);
  if (role) {
    await signIn(page, role);
    await page.addInitScript((profileId) => {
      window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
      window.localStorage.setItem("wave_install_hint_dismissed", "1");
    }, ACCOUNTS[role].id);
  } else {
    await page.addInitScript(() => window.localStorage.setItem("wave_install_hint_dismissed", "1"));
  }
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__waveNav?.isReady?.(), null, { timeout: 90_000 });
  await settle(page, 1500);
}

/** Resets to the role's tabs, then opens `name` — so each capture starts clean. */
async function go(page: Page, name: string, params?: object): Promise<void> {
  await page.evaluate(
    ([name, params]) => {
      const nav = (window as any).__waveNav;
      const root = nav.getRootState();
      const first = root?.routeNames?.[0];
      if (first && name !== first) nav.resetRoot({ index: 0, routes: [{ name: first }] });
      nav.navigate(name, params);
    },
    [name, params ?? undefined] as const,
  );
  await page.waitForTimeout(500);
}

const tab = (page: Page, screen: string) => go(page, "Tabs", { screen });

function nextWave(): string {
  const d = new Date();
  while (d.getDay() !== 0 && d.getDay() !== 3) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
const WAVE = { scheduledDate: nextWave(), isSpecialOrder: false };

// ═══════════════════════════════════════════════════════════════════════════
// Signed out
// ═══════════════════════════════════════════════════════════════════════════

test("@mobile auth", async ({ page }) => {
  test.skip(BFM !== "closed", "signed-out screens do not depend on Buy for me");
  await boot(page, null);
  const R = "1-signed-out";
  await capture(page, R, 1, "welcome", "default", async () => {});
  await capture(page, R, 2, "phone-entry", "empty", () => go(page, "PhoneEntry"));
  await capture(page, R, 2, "phone-entry", "full", async () => {
    await page.locator("input:visible").first().fill("241234567");
  });
  await capture(page, R, 3, "otp-verify", "default", () => go(page, "OtpVerify", { phone: "+233241234567" }));
  await capture(page, R, 4, "role-select", "default", () => go(page, "RoleSelect"));
  await capture(page, R, 5, "profile-setup-student", "default", () => go(page, "ProfileSetup", { role: "student" }));
  await capture(page, R, 6, "profile-setup-rider", "default", () => go(page, "ProfileSetup", { role: "rider" }));
  await capture(page, R, 7, "profile-setup-shop-owner", "default", () => go(page, "ProfileSetup", { role: "shop_owner" }));
  await capture(page, R, 8, "not-found", "default", async () => {
    await page.goto("/this-page-does-not-exist");
    await page.waitForTimeout(4000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Student — Buy for me closed (the launch state)
// ═══════════════════════════════════════════════════════════════════════════

const S = "2-student";

test("@mobile student full", async ({ page }) => {
  test.skip(BFM !== "closed");
  await boot(page, "student");
  await capture(page, S, 1, "home", "full", () => tab(page, "Home"));
  await capture(page, S, 2, "orders", "full", () => tab(page, "Orders"));
  await capture(page, S, 3, "checkpoints", "full", () => tab(page, "Checkpoints"));
  await capture(page, S, 4, "profile", "full", () => tab(page, "Profile"));
  await capture(page, S, 5, "wave-calendar", "default", () => go(page, "WaveCalendar"));
  await capture(page, S, 6, "choose-service", "default", () => go(page, "ChooseService", WAVE));
  await capture(page, S, 7, "pickup-request", "empty", () => go(page, "PickupRequest", WAVE));
  await capture(page, S, 7, "pickup-request", "full", async () => {
    await go(page, "PickupRequest", { ...WAVE, fromId: CP.hostelA, toId: CP.library });
    await page.waitForTimeout(800);
    await page.locator("textarea:visible, input:visible").last().fill("Laptop charger, in a black pouch");
  });
  await capture(page, S, 8, "suggest-shop", "empty", () => go(page, "SuggestShop", WAVE));
  await capture(page, S, 8, "suggest-shop", "full", async () => {
    await go(page, "SuggestShop", { ...WAVE, initialQuery: "Auntie Akos Waakye" });
  });
  await capture(page, S, 9, "suggest-order-summary", "default", () =>
    go(page, "SuggestOrderSummary", {
      ...WAVE,
      suggestionId: D(205),
      shopName: "Kofi Broke Man Stall",
      locationText: "Opposite the Ashesi gate",
      manualItems: [
        { name: "Plate, extra plantain", quantity: 2 },
        { name: "Sobolo (bottle)", quantity: 1 },
      ],
    }),
  );
  await capture(page, S, 10, "payment", "default", () => go(page, "Payment", { orderId: D(301), totalAmount: 20 }));
  await capture(page, S, 11, "payment-methods", "default", () => go(page, "PaymentMethods"));
  await capture(page, S, 12, "payment-return", "default", () =>
    go(page, "PaymentReturn", { orderId: D(301), reference: "demo-ref", totalAmount: 20 }),
  );
  await capture(page, S, 13, "payment-failed", "default", () => go(page, "PaymentFailed", { orderId: D(301), totalAmount: 20 }));
  await capture(page, S, 14, "order-confirmed", "default", () => go(page, "OrderConfirmed", { orderId: D(302) }));
  const tracking: [number, string][] = [
    [302, "awaiting-rider"],
    [303, "rider-assigned"],
    [304, "on-the-way"],
    [305, "at-checkpoint"],
    [306, "delivered"],
    [307, "refunded"],
  ];
  for (const [n, label] of tracking) {
    await capture(page, S, 15, `order-tracking-${label}`, "default", () => go(page, "OrderTracking", { orderId: D(n) }));
  }
  await capture(page, S, 16, "order-detail-delivered", "default", () => go(page, "OrderDetail", { orderId: D(306) }));
  await capture(page, S, 16, "order-detail-refunded", "default", () => go(page, "OrderDetail", { orderId: D(307) }));
  await capture(page, S, 17, "pickup-pin", "default", () => go(page, "PickupPin", { orderId: D(305) }));
  await capture(page, S, 18, "cutoff-passed", "default", () => go(page, "CutoffPassed"));
  await capture(page, S, 19, "shop-coming-soon", "default", () =>
    go(page, "ShopMenu", { ...WAVE, shopId: MAMA_PUT, shopName: "Mama Put Kitchen" }),
  );
});

test("@mobile student empty", async ({ page }) => {
  test.skip(BFM !== "closed");
  await emptyOut(page, /\/v1\/(orders\/my|shop-suggestions\/mine|universities\/[^/]+\/checkpoints)(\?|$)/);
  await boot(page, "student");
  await capture(page, S, 1, "home", "empty", () => tab(page, "Home"));
  await capture(page, S, 2, "orders", "empty", () => tab(page, "Orders"));
  await capture(page, S, 3, "checkpoints", "empty", () => tab(page, "Checkpoints"));
  await capture(page, S, 4, "profile", "empty", () => tab(page, "Profile"));
});

// ── Student — Buy for me open ───────────────────────────────────────────────

test("@mobile student buy-for-me full", async ({ page }) => {
  test.skip(BFM !== "open");
  await boot(page, "student");
  await capture(page, S, 20, "home-buy-for-me-open", "full", () => tab(page, "Home"));
  await capture(page, S, 21, "shop-selection", "full", () => go(page, "ShopSelection", WAVE));
  await capture(page, S, 22, "shop-menu", "full", () =>
    go(page, "ShopMenu", { ...WAVE, shopId: MAMA_PUT, shopName: "Mama Put Kitchen" }),
  );
  await capture(page, S, 23, "shop-menu-item-added", "full", async () => {
    await page.getByLabel(/^Add /).locator("visible=true").first().click();
  });
  await capture(page, S, 24, "order-summary", "full", () =>
    go(page, "OrderSummary", {
      ...WAVE,
      shopId: MAMA_PUT,
      shopName: "Mama Put Kitchen",
      items: [{ productId: "00000000-0000-0000-0000-000000000401", quantity: 2 }],
      itemsPreview: [{ name: "Jollof Rice + Chicken", unitPrice: 35, quantity: 2 }],
    }),
  );
  await capture(page, S, 25, "choose-service-buy-for-me-open", "default", () => go(page, "ChooseService", WAVE));
});

test("@mobile student buy-for-me empty", async ({ page }) => {
  test.skip(BFM !== "open");
  await emptyOut(page, /\/v1\/(orders\/my|shops|products)(\?|$)/);
  await emptyOut(page, /\/v1\/shops\/[^/]+\/(menu|products)/);
  await boot(page, "student");
  await capture(page, S, 20, "home-buy-for-me-open", "empty", () => tab(page, "Home"));
  await capture(page, S, 21, "shop-selection", "empty", () => go(page, "ShopSelection", WAVE));
  await capture(page, S, 22, "shop-menu", "empty", () =>
    go(page, "ShopMenu", { ...WAVE, shopId: MAMA_PUT, shopName: "Mama Put Kitchen" }),
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Rider
// ═══════════════════════════════════════════════════════════════════════════

const RD = "3-rider";

test("@mobile rider full", async ({ page }) => {
  test.skip(BFM !== "closed");
  await boot(page, "rider");
  await capture(page, RD, 1, "feed", "full", () => tab(page, "Feed"));
  await capture(page, RD, 2, "deliveries", "full", () => tab(page, "MyOrders"));
  // "Today" is empty on a non-Wave day; the history is under All time.
  await capture(page, RD, 3, "earnings", "full", async () => {
    await tab(page, "Earnings");
    await page.getByText("All time", { exact: true }).locator("visible=true").first().click();
  });
  await capture(page, RD, 4, "profile", "full", () => tab(page, "Profile"));
  await capture(page, RD, 5, "order-detail", "default", () => go(page, "OrderDetail", { orderId: D(311) }));
  await capture(page, RD, 6, "active-delivery-assigned", "default", () => go(page, "ActiveDelivery", { orderId: D(303) }));
  await capture(page, RD, 6, "active-delivery-on-the-way", "default", () => go(page, "ActiveDelivery", { orderId: D(304) }));
  await capture(page, RD, 6, "active-delivery-at-checkpoint", "default", () => go(page, "ActiveDelivery", { orderId: D(305) }));
  await capture(page, RD, 6, "active-delivery-suggested-shop", "default", () => go(page, "ActiveDelivery", { orderId: D(309) }));
  await capture(page, RD, 7, "pin-entry", "empty", () => go(page, "PinEntry", { orderId: D(305) }));
  await capture(page, RD, 7, "pin-entry", "full", async () => {
    await page.locator("input:visible").first().pressSequentially("730256", { delay: 60 }).catch(() => page.keyboard.type("730256"));
  });
  await capture(page, RD, 8, "record-goods-cost", "default", () => go(page, "RecordGoodsCost", { orderId: D(309) }));
  await capture(page, RD, 9, "submit-verification", "default", () => go(page, "SubmitVerification"));
});

test("@mobile rider empty", async ({ page }) => {
  test.skip(BFM !== "closed");
  await emptyOut(page, /\/v1\/(orders\/available|orders\/my-deliveries|riders\/earnings)(\?|$)/);
  await boot(page, "rider");
  await capture(page, RD, 1, "feed", "empty", () => tab(page, "Feed"));
  await capture(page, RD, 2, "deliveries", "empty", () => tab(page, "MyOrders"));
  await capture(page, RD, 3, "earnings", "empty", () => tab(page, "Earnings"));
});

for (const [status, label] of [
  ["pending", "verification-pending"],
  ["rejected", "verification-rejected"],
] as const) {
  test(`@mobile rider onboarding ${status}`, async ({ page }) => {
    test.skip(BFM !== "closed");
    await rewrite(page, /\/v1\/profile\/me(\?|$)/, (b) => ({ ...b, profile: { ...b.profile, isVerified: false } }));
    await rewrite(page, /\/v1\/riders\/verification\/status(\?|$)/, (b) => ({
      verification: {
        ...(b.verification ?? {}),
        status,
        rejectionReason: status === "rejected" ? "The selfie does not match the ID photo. Please retake it in good light." : null,
      },
    }));
    await signIn(page, "rider");
    await page.goto("/");
    await page.waitForTimeout(6000);
    await capture(page, RD, 10, label, "default", async () => {});
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Shop owner
// ═══════════════════════════════════════════════════════════════════════════

const SH = "4-shop-owner";

test("@mobile shop full", async ({ page }) => {
  test.skip(BFM !== "closed");
  await boot(page, "shop");
  // The owner has several shops and the dashboard opens on the first; the demo
  // orders are Mama Put Kitchen's.
  const pickShop = () => page.getByText("Mama Put Kitchen", { exact: true }).locator("visible=true").first().click();
  await capture(page, SH, 1, "today", "full", async () => {
    await tab(page, "Dashboard");
    await pickShop();
  });
  await capture(page, SH, 2, "orders", "full", () => tab(page, "ShopOrders"));
  await capture(page, SH, 3, "menu", "full", async () => {
    await tab(page, "Menu");
    await pickShop();
  });
  await capture(page, SH, 4, "settings", "default", () => tab(page, "Settings"));
  await capture(page, SH, 5, "incoming-order-detail", "default", () => go(page, "IncomingOrderDetail", { orderId: D(312) }));
});

test("@mobile shop empty", async ({ page }) => {
  test.skip(BFM !== "closed");
  await emptyOut(page, /\/v1\/(orders\/shop|products\/manage)(\?|$)/);
  await boot(page, "shop");
  await capture(page, SH, 1, "today", "empty", () => tab(page, "Dashboard"));
  await capture(page, SH, 2, "orders", "empty", () => tab(page, "ShopOrders"));
  await capture(page, SH, 3, "menu", "empty", () => tab(page, "Menu"));
});

test("@mobile shop setup", async ({ page }) => {
  test.skip(BFM !== "closed");
  await emptyOut(page, /\/v1\/shops\/my(\?|$)/);
  await signIn(page, "shop");
  await page.goto("/");
  await page.waitForTimeout(6000);
  await capture(page, SH, 6, "shop-setup", "default", async () => {});
});

// ═══════════════════════════════════════════════════════════════════════════
// Admin dashboard
// ═══════════════════════════════════════════════════════════════════════════

const AD = "5-admin";

const ADMIN_PAGES: [number, string, string][] = [
  [2, "dashboard", "/dashboard"],
  [3, "orders", "/orders"],
  [5, "refund-requests", "/refunds"],
  [6, "riders", "/riders"],
  [7, "shops", "/shops"],
  [8, "shop-suggestions", "/suggestions"],
  [9, "users", "/users"],
  [10, "checkpoints", "/checkpoints"],
  [11, "beta", "/beta"],
  [12, "activity-log", "/audit"],
  [13, "staff", "/staff"],
  [14, "campus-admins", "/campus-admins"],
];

async function adminPage(page: Page, path: string): Promise<void> {
  trackApi(page);
  await page.goto(path);
  // Bounded: the activity log holds a live stream open, so it never goes idle.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.getByText("Loading…").first().waitFor({ state: "detached", timeout: 20_000 }).catch(() => {});
}

test("@admin admin full", async ({ page }) => {
  test.skip(BFM !== "closed");
  // Next dev compiles each route on first visit, ~20s apiece.
  test.setTimeout(1_200_000);
  await capture(page, AD, 1, "login", "default", () => adminPage(page, "/login"));
  await signIn(page, "admin");
  for (const [n, name, path] of ADMIN_PAGES) {
    await capture(page, AD, n, name, "full", () => adminPage(page, path));
  }
  await capture(page, AD, 4, "order-detail", "default", () => adminPage(page, `/orders/${D(305)}`));
  await capture(page, AD, 4, "order-detail-refund-requested", "default", () => adminPage(page, `/orders/${D(333)}`));
  await capture(page, AD, 15, "config-and-switches", "default", () => adminPage(page, "/config"));
  await capture(page, AD, 16, "legal", "default", () => adminPage(page, "/legal"));
  await capture(page, AD, 17, "legal-terms", "default", () => adminPage(page, "/legal/terms"));
  await capture(page, AD, 18, "legal-privacy", "default", () => adminPage(page, "/legal/privacy"));
  await capture(page, AD, 19, "legal-refunds", "default", () => adminPage(page, "/legal/refunds"));
  await capture(page, AD, 20, "not-found", "default", () => adminPage(page, "/no-such-page"));
});

test("@admin admin empty", async ({ page }) => {
  test.skip(BFM !== "closed");
  test.setTimeout(1_200_000);
  // Everything an operator reads, emptied; their own identity and the
  // campus configuration are left alone, since no campus is without them.
  await page.route(/\/v1\/admin\//, async (route) => {
    const url = route.request().url();
    if (route.request().method() !== "GET" || /\/admin\/(staff\/me|config|features|switches|audit\/stream)(\?|$)/.test(url)) {
      return route.continue();
    }
    const response = await route.fetch();
    return route.fulfill({ response, json: blank(await response.json()) });
  });
  await signIn(page, "admin");
  for (const [n, name, path] of ADMIN_PAGES) {
    await capture(page, AD, n, name, "empty", () => adminPage(page, path));
  }
});
