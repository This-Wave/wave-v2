# Wave — Mobile release (EAS)

**Last updated:** 2026-08-25
**Covers:** review 08-mobile C1 and "OTA / EAS build profiles not configured";
go-live checklist **C14**.

`eas.json` exists with three build profiles. **EAS itself is not initialised** —
`app.json` still has `"projectId": ""`, so no build or push notification can work
yet. That step needs an Expo account and is on the owner (`forAbeiku.md` §2).

---

## 1. One-time setup

```
cd apps/mobile
eas login
eas init          # writes the projectId into app.json — commit that change
```

Then verify push actually registers, on **two physical devices** (an emulator will
not prove this):

```
eas build --profile preview --platform android
```

Install, sign in, and confirm a push token reaches the API. Riders learn about new
orders this way; if it silently fails, the rider side of the pilot does not work.

---

## 2. Build profiles

| Profile | Distribution | Channel | Use |
|---------|--------------|---------|-----|
| `development` | internal, dev client | — | Local work against a dev server |
| `preview` | internal, Android **APK** | `preview` | Shareable test build. APK because a testers' build should install by sideload, not through a store |
| `production` | store | `production` | Pilot release. `autoIncrement` handles build numbers |

`appVersionSource: "remote"` — EAS owns the build number, so two people building do
not collide on it.

---

## 3. Environment variables

**No `EXPO_PUBLIC_*` values are committed to `eas.json`.** Deliberate: they would be
a second source of truth alongside Render, and a renamed service would leave builds
silently pointing at a dead host. Set them as EAS secrets instead:

```
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://<api-host>/v1
```

Required for a working production build:

| Variable | Notes |
|----------|-------|
| `EXPO_PUBLIC_API_URL` | Must include the `/v1` suffix and point at the **production** API |
| `EXPO_PUBLIC_SUPABASE_URL` | |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key only — never the service role key |
| `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` | `pk_live_…` for real money, `pk_test_…` otherwise. Must match the secret key set on the API, or payments fail with a key mismatch |

Optional but expected before open pilot:

| Variable | Consequence if unset |
|----------|----------------------|
| `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL` | The legal links on signup point nowhere |
| `EXPO_PUBLIC_SUPPORT_EMAIL` / `EXPO_PUBLIC_SUPPORT_WHATSAPP` | No support contact on Profile screens |
| `EXPO_PUBLIC_SENTRY_DSN` | No crash reporting from devices |

> `EXPO_PUBLIC_*` values are **inlined at build time** and readable by anyone who
> unpacks the app. That is fine for these — they are all public-by-design keys — but
> it is exactly why the Supabase *service role* key and the Paystack *secret* key
> must never be given this prefix.

---

## 4. Release checklist

- [ ] `eas init` run; `projectId` committed
- [ ] All required secrets set for the `production` profile
- [ ] `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` matches the API's `PAYSTACK_SECRET_KEY`
      (both test, or both live — a mixed pair fails at checkout)
- [ ] Push token verified on two physical devices
- [ ] Device walkthrough passed (`docs/pilot-e2e-walkthrough.md`, checklist C16)
- [ ] Terms and privacy URLs resolve

---

## 5. OTA updates

The `preview` and `production` channels are declared, but `expo-updates` is not
configured. Until it is, a fix requires a full store build. Worth setting up if the
pilot runs long enough that waiting on review becomes painful — not before.
