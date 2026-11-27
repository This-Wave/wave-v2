import { test, type Page, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * Moolre MoMo recovery states (2026-11-27): "could not confirm" with Send it
 * again, and a charge the network declined.
 *
 * The payment calls are answered in the browser, so no prompt reaches anyone's
 * phone and no money moves; everything else talks to the local API. An unpaid
 * order is injected into `/orders/my` so Home offers "finish paying".
 *   npx playwright test -c e2e/playwright.shots.config.ts moolre-recovery-screenshots
 */
const ROOT = resolve(__dirname, "../../screenshots/moolre-recovery");
mkdirSync(ROOT, { recursive: true });

const FAKE_ID = "00000000-0000-4000-8000-00000000a0a0";
const REF = `WAVEM-${FAKE_ID}-1795180000000`;

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(ROOT, `${name}.png`) });
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}


async function setup(page: Page) {
  await signIn(page, "student");
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS.student.id);
  const now = new Date().toISOString();
  await page.route("**/v1/profile/me", (route) =>
    json(route, {
      profile: {
        id: ACCOUNTS.student.id, universityId: "ashesi", fullName: ACCOUNTS.student.name,
        phone: ACCOUNTS.student.phone, studentId: null, email: null, role: "student", avatarUrl: null,
        pushToken: null, isActive: true, isAvailable: false, isVerified: true, createdAt: now, updatedAt: now,
      },
    }),
  );
  const fake: Record<string, unknown> = {
    id: FAKE_ID, studentId: ACCOUNTS.student.id, riderId: null, orderType: "parcel", originCheckpointId: null,
    shopId: null, suggestionId: null, checkpointId: "cp-1", checkpoint: { id: "cp-1", name: "Ashesi Quad" },
    universityId: "ashesi", productId: null, itemDescription: "Parcel from Accra", itemPrice: null,
    deliveryFee: "40.00", discountApplied: "0", surchargeApplied: "0", totalAmount: "40.00",
    status: "payment_pending", deliveryDay: "friday", scheduledDate: "2026-11-27", isSpecialOrder: false,
    paystackRef: null, paidAt: null, goodsPaidAt: null, shopAcceptedAt: null, deliveredAt: null, notes: null,
    cancellationReason: null, createdAt: now, updatedAt: now,
  };
  await page.route("**/v1/orders/my*", (route) => json(route, { orders: [fake] }));
  await page.route(`**/v1/orders/${FAKE_ID}`, (route) => json(route, { order: fake }));
}

async function toPay(page: Page) {
  await page.goto("/");
  await page.getByText("Finish paying").waitFor({ timeout: 60_000 });
  await page.getByText("Finish paying").click();
  await page.getByText("MoMo number").waitFor();
  await page.getByLabel("MoMo number").fill("24 123 4521");
  await page.getByRole("button", { name: /^Pay / }).click();
}

test("@mobile unconfirmed prompt offers Send it again", async ({ page }) => {
  await setup(page);
  const refs = [REF, REF.replace("1795180000000", "1795180999999")];
  let initiates = 0;
  await page.route("**/v1/payments/initiate", (route) => {
    const reference = refs[Math.min(initiates, 1)]!;
    initiates += 1;
    return json(route, { provider: "moolre", reference, next: "approve", prompt: initiates === 1 ? "unconfirmed" : "sent", payer: "0241234521", network: "MTN" });
  });
  await page.route("**/v1/payments/verify/**", (route) => json(route, { status: "payment_pending", paidAt: null }));

  await toPay(page);
  await page.getByText(/could not confirm/i).waitFor();
  await shot(page, "01-unconfirmed");
  await page.getByRole("button", { name: "Send it again" }).click();
  await page.getByText(/Check 024/).waitFor();
  await shot(page, "02-resent-prompt-on-phone");
  console.log("initiate calls:", initiates);
});

test("@mobile a declined charge returns to payment with a clear message", async ({ page }) => {
  await setup(page);
  await page.route("**/v1/payments/initiate", (route) =>
    json(route, { provider: "moolre", reference: REF, next: "approve", prompt: "sent", payer: "0241234521", network: "MTN" }),
  );
  await page.route("**/v1/payments/verify/**", (route) =>
    json(route, { status: "payment_pending", paidAt: null, declined: true }),
  );

  await toPay(page);
  await page.getByText(/payment was declined/i).waitFor({ timeout: 20_000 });
  await shot(page, "03-declined");
  await page.getByText("MoMo number").waitFor();
});
