import { test, type Page, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ACCOUNTS } from "../fixtures/accounts";
import { signIn } from "../fixtures/session";

/**
 * Moolre MoMo checkout: number + network, SMS code, approve on phone.
 *
 * The payment calls are answered in the browser, so no prompt reaches anyone's
 * phone and no money moves; everything else talks to the local API. An unpaid
 * order is injected into `/orders/my` so Home offers "finish paying".
 *   npx playwright test -c e2e/playwright.shots.config.ts moolre-screenshots
 */
const ROOT = resolve(__dirname, "../../screenshots/moolre");
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

test("@mobile MoMo checkout through Moolre", async ({ page }) => {
  await signIn(page, "student");
  await page.addInitScript((profileId) => {
    window.localStorage.setItem(`wave_tour_seen_${profileId}`, "1");
    window.localStorage.setItem("wave_install_hint_dismissed", "1");
  }, ACCOUNTS.student.id);

  // The local dev database can lag the schema; answer the two reads Home
  // needs from fixtures so the run depends only on the checkout code.
  const now = new Date().toISOString();
  await page.route("**/v1/profile/me", (route) =>
    json(route, {
      profile: {
        id: ACCOUNTS.student.id,
        universityId: "ashesi",
        fullName: ACCOUNTS.student.name,
        phone: ACCOUNTS.student.phone,
        studentId: null,
        email: null,
        role: "student",
        avatarUrl: null,
        pushToken: null,
        isActive: true,
        isAvailable: false,
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    }),
  );
  const fake: Record<string, unknown> = {
    id: FAKE_ID,
    studentId: ACCOUNTS.student.id,
    riderId: null,
    orderType: "parcel",
    originCheckpointId: null,
    shopId: null,
    suggestionId: null,
    checkpointId: "cp-1",
    checkpoint: { id: "cp-1", name: "Ashesi Quad" },
    universityId: "ashesi",
    productId: null,
    itemDescription: "Parcel from Accra",
    itemPrice: null,
    deliveryFee: "40.00",
    discountApplied: "0",
    surchargeApplied: "0",
    totalAmount: "40.00",
    status: "payment_pending",
    deliveryDay: "friday",
    scheduledDate: "2026-11-27",
    isSpecialOrder: false,
    paystackRef: null,
    paidAt: null,
    goodsPaidAt: null,
    shopAcceptedAt: null,
    deliveredAt: null,
    notes: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
  };
  await page.route("**/v1/orders/my*", (route) => json(route, { orders: [fake] }));
  await page.route(`**/v1/orders/${FAKE_ID}`, (route) => json(route, { order: fake }));

  const initiateBodies: unknown[] = [];
  await page.route("**/v1/payments/initiate", async (route) => {
    initiateBodies.push(route.request().postDataJSON());
    await json(route, { provider: "moolre", reference: REF, next: "otp", payer: "0241234521", network: "MTN" });
  });
  let otpTries = 0;
  await page.route("**/v1/payments/momo/otp", async (route) => {
    otpTries += 1;
    if (otpTries === 1) return json(route, { error: "bad", code: "otp_wrong" }, 400);
    return json(route, { provider: "moolre", reference: REF, next: "approve", payer: "0241234521", network: "MTN" });
  });
  await page.route("**/v1/payments/verify/**", (route) => json(route, { status: "payment_pending", paidAt: null }));

  await page.goto("/");
  await page.getByText("Finish paying").waitFor({ timeout: 60_000 });
  await shot(page, "01-home-unpaid");
  await page.getByText("Finish paying").click();

  await page.getByText("How?").waitFor();
  await page.getByText("MoMo number").waitFor();
  await shot(page, "02-pay-with-momo");

  // A ported number: type a Telecel prefix, then pick MTN by hand.
  const field = page.getByLabel("MoMo number");
  await field.fill("50 123 4521");
  await shot(page, "03-network-follows-number");
  await page.getByRole("button", { name: "MTN" }).click();
  await field.fill("24 123 4521");
  await shot(page, "04-network-picked");

  await page.getByRole("button", { name: /^Pay / }).click();
  await page.getByText("Enter the SMS code").waitFor();
  await shot(page, "05-sms-code");

  await page.getByLabel("Mobile Money SMS code").pressSequentially("111111");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("That code is not right").waitFor();
  await shot(page, "06-wrong-code");

  await page.getByLabel("Mobile Money SMS code").pressSequentially("123456");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Approve on your phone").waitFor();
  await shot(page, "07-approve-on-phone");

  console.log("initiate bodies:", JSON.stringify(initiateBodies));
});
