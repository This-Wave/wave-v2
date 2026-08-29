# Wave — Supabase dashboard configuration

**Last updated:** 2026-08-25
**Why this exists:** review 06-devops, M4 — Wave's Supabase setup (auth, storage
buckets, the SMS hook) lives entirely in the dashboard. None of it is in code, so
none of it is reviewable, diffable, or reproducible. If the project were recreated
tomorrow, this list is the only thing standing between you and a silent half-working
install.

**Scope reminder:** Supabase provides Auth, Storage and Realtime **only**. The
database is Neon, managed by `packages/db/prisma/schema.prisma`. Never create tables
here.

---

## 1. Auth

| Setting | Value | Why |
|---------|-------|-----|
| Phone provider | **Enabled** | Students sign in by phone, not email |
| Email provider | Disabled (or unused) | No email/password path exists in the app |
| Confirm phone | Required | `POST /auth/register` now demands an OTP-verified session — see below |
| SMS provider | **Custom hook** (not a built-in provider) | Wave delivers OTPs via mNotify |

### The SMS hook

Supabase generates and verifies the OTP; it only delegates *delivery* to Wave.

- **Hook URL:** `https://<api-host>/v1/auth/sms-hook`
- **Secret:** must equal the API's `SMS_HOOK_SECRET` env var
- Signature is Standard Webhooks, verified in `auth/routes.ts` before anything is sent

> If the secret does not match, every signup silently fails at the OTP step and the
> API answers 401. Check `SMS_HOOK_SECRET` on both sides first when signups break.

> **Since 2026-08-25** `POST /auth/register` requires a bearer token from an
> OTP-verified session. Phone confirmation is no longer cosmetic — if the phone
> provider is misconfigured, password registration stops working entirely.

---

## 2. Storage buckets

Both are referenced by name in code. The names are not configurable at runtime.

### `verifications` — rider ID and selfie uploads

| Setting | Value |
|---------|-------|
| Public | **No.** Private |
| Access | Service-role key only |
| Read path | Signed URLs, 1-hour expiry (`VERIFICATION_SIGNED_URL_TTL_SECONDS`) |

Contains government ID photographs. It must never be public, and no public URL
should ever be generated for it. The API bypasses Storage RLS with the service-role
key (`modules/riders/routes.ts`), so **bucket privacy is the only control** — there
is no second layer to catch a mistake here.

### `product-images` — shop product photos

| Setting | Value |
|---------|-------|
| Public | Yes — these render in the student catalogue |

---

## 3. Realtime

- Enable on the `orders` table **only after** RLS policies are applied.
  See GOTCHA-004 in `debug.md`.

---

## 4. Verifying a fresh project

Run through this after any Supabase project recreation, and after rotating the
service-role key (checklist C12):

- [ ] Phone auth enabled; a test number receives an OTP
- [ ] SMS hook URL points at the **current** API host (it changes between staging and prod)
- [ ] `SMS_HOOK_SECRET` matches on both sides
- [ ] `verifications` bucket exists and is **private**
- [ ] Fetching a `verifications` object without a signed URL returns 403
- [ ] `product-images` bucket exists and is public
- [ ] A rider verification upload succeeds and the admin can view it via signed URL
- [ ] Realtime on `orders` only, and only with RLS in place

---

## Known limitation

This is a checklist, not infrastructure-as-code. Supabase's CLI can manage some of
this declaratively (`supabase/config.toml`), and moving to that would make the setup
diffable and reviewable like the rest of the repo. Worth doing if Wave ever runs more
than one Supabase project — for a single pilot project, the cost of drift is one
person re-reading this page.
