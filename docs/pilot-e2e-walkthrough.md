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

## Shop Accept vs rider dispatch — what "Accept" actually does

**QA acceptance criteria (review 02-qa-engineer, M2).** This is the single
easiest thing to mis-test, because the button reads like a gate and is not one.

`shopAcceptedAt` is **advisory**. The shop's Accept records an acknowledgement
the dashboard and riders can see. It does **not** gate dispatch: the rider feed
is filtered by `status: "confirmed"`, campus, and rider verification — never by
`shopAcceptedAt`. Verified in `orders/routes.ts` (written on accept, read
nowhere as a precondition).

| Scenario | Expected |
|----------|----------|
| Order paid, shop has **not** accepted | Rider **can** see and accept it |
| Order paid, shop **has** accepted | Rider can see and accept it; timeline shows the acknowledgement |
| Shop taps Accept twice | Second tap succeeds (idempotent) — not an error |
| Shop A tries to accept Shop B's order | 404 — scoped by ownership in the query predicate |

**Do not** file "rider saw an unaccepted order" as a bug. If Accept should gate
dispatch, that is a product change, not a defect.

---

## Dual-payment (`shop_pickup`) scripted regression

**Review 02-qa-engineer, M3.** A suggested-shop order is charged **twice** —
the delivery fee at order time, the goods after the rider reports the till
total. Two Paystack transactions, two references, two webhooks. Run the whole
script; a partial run proves nothing, because the failure mode is the second
charge interacting with the first.

| # | Step | Pass criteria |
|---|------|---------------|
| 1 | Student: **Suggest a shop**, add ≥2 manual items, place order | Order created, `orderType: shop_pickup`, `suggestionId` set, `shopId` null |
| 2 | Check the order before paying | Total = delivery fee only. No item price yet — nobody knows it |
| 3 | Pay the delivery fee (test card) | `paidAt` set, `paystackRef` set, status `confirmed` |
| 4 | Confirm the PIN arrived | SMS received **once**; in-app PIN matches |
| 5 | Rider accepts, goes to the shop | Order appears in the rider feed after step 3, not before |
| 6 | Rider records goods cost (per-unit prices) | Server multiplies by quantity — check the arithmetic, not the rider's |
| 7 | Student is notified goods are payable | Second checkout offered; amount = sum of recorded lines |
| 8 | Pay the goods charge | `goodsPaidAt` set, `goodsPaystackRef` set and **different** from `paystackRef` |
| 9 | Rider delivers with the PIN | Delivery succeeds; the PIN from step 4 still works |
| 10 | Admin order detail | Both references shown; amounts reconcile against Paystack |

**Negatives to run in the same session:**

- Re-submit the delivery-fee checkout after step 3 → refused; `paystackRef` unchanged.
- Replay the step-3 webhook → no second PIN SMS, no PIN change.
- Cancel after step 3 but before step 8 → **only** the delivery fee is refunded.
- Cancel after step 8 → **both** references refunded.

---

## Negative tests

Run these every pass. They are the cases where a silent success is worse than
a visible failure.

| Test | Expected |
|------|----------|
| Deliver with a wrong PIN | Rejected; cooldown applies after repeated attempts |
| Rider A delivers Rider B's order with a valid PIN | Rejected — the PIN is not the only check |
| Open another student's order by ID | 404, not a redacted order |
| Initiate payment on an already-paid order | Refused; the settled reference is never overwritten |
| Resend the PIN twice inside a minute | Second is throttled (429) |
| Shop owner edits another shop's product | 404 |
| Unverified rider tries to accept a job | Refused |
| Open a deactivated shop by direct URL | 404, identical to a shop that never existed |

---

## Visual / design drift checklist

**Review 02-qa-engineer, L2.** Capture these on every release and diff against
the previous set. v6 rules from `CLAUDE.md`: no gradients, no colored shadows,
no emoji, three radii only (card 12px, input 8px, pill 9999px), DM Sans.

| Surface | Screens to capture |
|---------|--------------------|
| Mobile — student | Home, shop detail, basket, calendar, checkout, order tracking, PIN |
| Mobile — rider | Feed, job detail, deliver/PIN entry, earnings |
| Mobile — shop | Incoming orders, menu list, product edit |
| Admin | Login, dashboard, orders list, order detail, riders, suggestions |

Check on each: lime (`#87ea5c`) appears as fill only and never as text; every
lime CTA carries an ink (`#083400`) label; cards have no border and no shadow;
shadow appears only on the search capsule and sheets.

## Sign-off checklist

Copy into your release notes when complete:

- [ ] Student checkout → Paystack test card → order marked paid
- [ ] Rider accept → deliver with PIN succeeds
- [ ] Shop accept succeeds
- [ ] Admin order detail matches Paystack reference and GHS amounts
- [ ] No unexpected 401/403/502 in browser network tab during flow
- [ ] Sentry (if `SENTRY_DSN` set) shows no unhandled payment errors during run
- [ ] Dual-payment (`shop_pickup`) script completed end to end, both refs distinct
- [ ] Negative tests all refused as expected
- [ ] Visual checklist captured; no v6 drift (no gradients/colored shadows/emoji)

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
