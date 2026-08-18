# Wave — Pilot E2E Walkthrough (Test Paystack)

**Checklist item:** C16  
**Last updated:** 2026-08-17  
**Stack:** Paystack **test** keys only (`sk_test_…` / `pk_test_…`)

Run this once before open pilot or before switching to live Paystack keys. Every step should pass on production URLs with seeded data.

---

## Prerequisites

| Item | Expected |
|------|----------|
| API | `https://wave-api-ei19.onrender.com/health` → `{ "status": "ok", "db": "ok" }` |
| Admin | `https://wave-admin.onrender.com` loads login |
| Student web | `https://wave-liart-pi.vercel.app` loads home |
| Paystack | API `PAYSTACK_SECRET_KEY` starts with `sk_test_` (not `pk_`) |
| Mobile web | `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` = matching `pk_test_…` |
| Database | Neon seeded (`npm run db:seed` + `npm run db:seed:auth`) |

**Paystack test card (success):**

| Field | Value |
|-------|-------|
| Number | `4084 0840 8408 4081` |
| Expiry | any future date |
| CVV | `408` |
| PIN | `0000` |
| OTP | `123456` |

---

## Seeded test accounts

Password sign-in on all roles (phone entry accepts `024…` or `+233…`):

| Role | Phone | Password |
|------|-------|----------|
| Student | `+233241234567` | `WaveDev123!` |
| Rider | `+233551234567` | `WaveRider123!` |
| Shop owner | `+233201234567` | `WaveShop123!` |
| Admin | `+233271234567` | `WaveAdmin123!` |

Default shop: **Mama Put Kitchen** (Jollof Rice and other items in seed).

---

## Walkthrough

### 1 — Student places order

1. Open **student web** (or Expo dev client pointed at prod API).
2. Sign in as student (`0241234567` / `WaveDev123!`).
3. Pick **Mama Put Kitchen**, add **Jollof Rice** (or any product) to cart.
4. Choose a campus checkpoint and confirm checkout.
5. Note the order total (delivery fee + items).

**Pass:** Order reaches checkout / payment screen with a Paystack pay button.

### 2 — Student pays delivery fee (Paystack test)

1. Tap pay; Paystack checkout opens (card or MoMo — use **card** for repeatable test).
2. Pay with the test card above.
3. Return to Wave; order tracking should show **paid** / rider-visible within ~30s.

**Pass:**

- No 502 on `POST /v1/payments/initiate`
- Order status moves past `payment_pending` (poll `/v1/payments/verify/:ref` or UI updates)
- Student sees tracking screen with active order

**If stuck on unpaid:** Check API logs for Paystack errors; confirm `APP_URL` and `sk_test_` secret on Render.

### 3 — Rider accepts and delivers

1. Sign out student (or use another browser / incognito).
2. Sign in as **rider** (`0551234567` / `WaveRider123!`).
3. Open available orders → **Accept** the test order.
4. Progress through pickup → en route → at checkpoint.
5. Enter the **6-digit delivery PIN** shown to the student (in-app notification / order detail).

**Pass:** Order status becomes **delivered** (or equivalent terminal rider state).

### 4 — Shop accepts order

1. Sign in as **shop owner** (`0201234567` / `WaveShop123!`).
2. Open incoming orders for Mama Put Kitchen.
3. **Accept** / confirm the order through the shop flow.

**Pass:** Shop order list shows the order handled; no ACL errors in network tab.

### 5 — Admin verification

1. Open **admin** → sign in (`0271234567` / `WaveAdmin123!`).
2. Find the test order in **Orders** → open detail.
3. Confirm amounts, status timeline, and Paystack reference look correct.

**Pass:** Admin order detail loads; refund button visible (do **not** refund unless testing refunds separately).

---

## Optional — Suggested-shop goods payment

Only if testing the two-charge flow:

1. Place an order via **Suggest a shop** (not catalogue shop).
2. Pay **delivery fee** first (steps 1–2).
3. After shop confirms item price, pay **goods** charge via second Paystack checkout.
4. Confirm `goodsPaidAt` set in admin detail.

---

## Sign-off checklist

Copy into your release notes when complete:

- [ ] Student checkout → Paystack test card → order marked paid
- [ ] Rider accept → deliver with PIN succeeds
- [ ] Shop accept succeeds
- [ ] Admin order detail matches Paystack reference and GHS amounts
- [ ] No unexpected 401/403/502 in browser network tab during flow
- [ ] Sentry (if `SENTRY_DSN` set) shows no unhandled payment errors during run

**Signed:** _______________ **Date:** _______________

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| 502 on pay | `PAYSTACK_SECRET_KEY` is `pk_` or wrong key |
| CORS error | Missing student/admin URL in API `CORS_ORIGINS` |
| Paid in Paystack, unpaid in app | Cold-start dropped webhook — keep app open (verify poll recovers) or upgrade API plan (C11) |
| Rider sees no orders | Rider not verified in seed, or wrong `universityId` |
| Blank student web | Rebuild Vercel with correct `EXPO_PUBLIC_*` vars |
