# Wave — Debug Log

> This file tracks every error, unexpected behavior, and bug encountered across all sessions.
> Every issue must include: symptom, root cause, fix applied, files changed, and prevention note.
> Issues are moved from "Active" to "Resolved" once fixed and verified.

---

## Active Issues

*None currently open.*

---

## Resolved Issues

### NativeWind `className` prop not recognized on React Native components
**Session:** 3 (2026-07-09)
**Severity:** Low
**Symptom:** `npm run type-check --workspace=@wave/mobile` failed with `TS2769: No overload matches this call` on every component using `className` (`SafeAreaView`, `View`, `Text`), even after adding `/// <reference types="nativewind/types" />` in `apps/mobile/nativewind-env.d.ts` as NativeWind's own docs describe.
**Root Cause:** The triple-slash reference resolved correctly (confirmed the file was included via `tsc --listFiles`), but the `declare module "react-native"` augmentation inside `node_modules/nativewind/types.d.ts` did not merge into the project's type-checking pass in this Expo 51 + TS 5.5 + npm-workspaces setup. Likely a module-identity mismatch between the ambient augmentation and the hoisted `react-native` types package used by the compiler.
**Fix Applied:** Replaced the triple-slash reference with the same `declare module "react-native" { interface ViewProps { className?: string } ... }` augmentation written directly (not referenced) in `apps/mobile/nativewind-env.d.ts`.
**Files Changed:** `apps/mobile/nativewind-env.d.ts`
**Prevention:** If NativeWind type errors resurface after a dependency bump, don't assume the triple-slash reference is being picked up just because it resolves — verify the augmented properties actually appear on a component's props (e.g. temporarily hover/typecheck a `className` usage) before spending time elsewhere.

---

---

## Known Gotchas (Pre-emptive)

These are not bugs yet, but known risks based on the tech stack that future sessions should be aware of:

### GOTCHA-001: Supabase DB Pausing
**Risk:** If someone accidentally points `DATABASE_URL` at Supabase's database instead of Neon.tech, the DB will pause after 7 days of inactivity.
**Prevention:** `DATABASE_URL` must always point to `ep-xxx.neon.tech`. The Supabase connection is used only for Auth (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) — never for DB queries.
**Check:** Run `npx prisma db pull` — if it fails with a Supabase URL, the env is wrong.

### GOTCHA-002: Paystack Amount in Pesewas
**Risk:** Paystack expects amounts in the smallest currency unit (pesewas), not cedis. Sending `5.00` instead of `500` will charge 5 pesewas (GHS 0.05) instead of GHS 5.00.
**Prevention:** Always multiply by 100: `Math.round(order.total_amount * 100)` before sending to Paystack.
**Check:** Test with Paystack's test keys and verify the amount shown on the checkout page.

### GOTCHA-003: PIN Hash Exposure via RLS
**Risk:** If the RLS policy `no_pin_exposure` is not applied correctly, the `delivery_pin_hash` column could be returned to clients.
**Prevention:** Apply the RLS policy immediately after creating the `orders` table. Verify by making a client-side query to `/orders/:id` and confirming `delivery_pin_hash` is null/absent in response.
**Check:** The API layer should also explicitly exclude `delivery_pin_hash` from all Prisma select queries that return order data to clients.

### GOTCHA-004: Supabase Realtime Requires RLS
**Risk:** Supabase Realtime postgres_changes subscriptions respect RLS policies. If RLS is not enabled on the `orders` table, all clients would receive all order updates — a serious data leak.
**Prevention:** Enable RLS on `orders` table before enabling Realtime subscriptions. Test that a student's subscription only receives updates for their own orders.

### GOTCHA-005: Special Order 24-Hour Lead Time
**Risk:** If lead time is only validated client-side, a user could construct a direct API request for a special order with `scheduled_date` set to today.
**Prevention:** Always validate `scheduled_date >= NOW() + INTERVAL '24 hours'` server-side in the orders API route.

### GOTCHA-006: Railway Free Tier Sleep
**Risk:** Railway's free Starter plan sleeps inactive services after a period of inactivity. This means the first request after sleep may take 5-10 seconds (cold start).
**Prevention:** During pilot, this is acceptable. When Wave goes to production, upgrade Railway to paid plan or use a keep-alive ping (cron job hitting `/health` every 10 minutes).

### GOTCHA-007: Expo Push Notification Token Expiry
**Risk:** Expo push tokens can expire or change when a user reinstalls the app. Sending to a stale token will fail silently.
**Prevention:** Store push tokens in the `profiles` table (`push_token` column — not currently in schema, needs to be added). Update the token on every app launch. Handle `DeviceNotRegistered` errors from Expo by clearing the token.

---

*Last updated: Session 1, June 2026*
