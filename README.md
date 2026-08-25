# Wave

**Campus delivery for Ghanaian universities.** Students place "Buy For Me" orders from off-campus shops, riders pick up and deliver to campus checkpoints, and shop owners manage their storefronts — all in one app. Piloting at **Ashesi University**, Berekuso.

[![CI](https://github.com/This-Wave/wave-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/This-Wave/wave-v2/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)](#license)

---

## Table of Contents

- [What is Wave?](#what-is-wave)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Install](#install)
  - [Environment variables](#environment-variables)
  - [Database setup](#database-setup)
  - [Running the apps](#running-the-apps)
- [Available scripts](#available-scripts)
- [Testing](#testing)
- [Design system](#design-system)
- [Security](#security)
- [Git workflow](#git-workflow)
- [Deployment](#deployment)
- [Cost model](#cost-model)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## What is Wave?

Wave connects three groups on a university campus:

| Role | What they do |
|---|---|
| **Student** | Places "Buy For Me" orders — a rider buys an item from an off-campus shop on their behalf and delivers it to a checkpoint. Pays via Paystack (card or MTN/Vodafone MoMo). Confirms pickup with a 6-digit PIN. |
| **Rider / Partner** | Verified (ID + selfie, admin-approved) delivery partner. Accepts open orders, buys the item, delivers to the checkpoint, gets paid out. |
| **Shop** | Lists products, toggles availability, accepts or cancels incoming orders. |
| **Admin** | Verifies riders and shops, configures checkpoints and platform settings, monitors orders, issues refunds. |

### Delivery schedule

| Day | Type | Surcharge |
|---|---|---|
| Sunday | Standard | None |
| Wednesday | Standard | None |
| Any other day | Special order | +30% (configurable), requires ≥24h notice |

### Loyalty

Students who complete **6 cumulative deliveries** get a **20% discount on the delivery fee** (never on the item price) on every order after that.

### Checkpoints

Orders aren't delivered door-to-door — they're handed off at pre-defined campus **checkpoints** (gate, library, hostel entrance, etc). Students confirm collection with a 6-digit PIN sent by push notification; the PIN is bcrypt-hashed server-side and never exposed to any client.

---

## How it works

```
Student places order
        │
        ▼
Fastify API validates delivery day, calculates total server-side
(never trusts a client-sent price), creates a Paystack transaction
        │
        ▼
Student pays via Paystack checkout (card / MoMo)
        │
        ▼
Paystack webhook (HMAC-SHA512 signature verified) confirms payment
        │
        ▼
Order → "confirmed", 6-digit PIN generated + bcrypt-hashed,
riders notified via Supabase Realtime
        │
        ▼
Rider accepts → buys item → delivers to checkpoint
        │
        ▼
Student shows PIN → rider marks "delivered" → PIN verified server-side
        │
        ▼
Rider earnings credited, student's delivery count incremented
```

See the full spec — data model, API surface, security design, testing strategy, and the 15-week build plan — in `Wave_Technical_Document.md` (kept locally, not tracked in this repo; ask a team member for a copy).

---

## Tech stack

Chosen for maximum capability at near-zero cost during the pilot phase (~500–2,000 users), with a documented, zero-code-change upgrade path for every piece.

| Layer | Technology | Why |
|---|---|---|
| Mobile app | **React Native (Expo)** + NativeWind + React Navigation + Zustand | One codebase for iOS/Android, OTA updates without App Store review cycles |
| Admin dashboard | **Next.js 14** (App Router) + Tailwind CSS | Free hosting on Vercel, SSR + API routes |
| Backend API | **Fastify** + TypeScript | Faster than Express, schema validation built in |
| Database | **Neon.tech PostgreSQL 16** via **Prisma** | Free tier, **never pauses** (unlike Supabase's DB), branching for dev/staging |
| Auth / Storage / Realtime | **Supabase** | Free, does not pause; used *only* for these three — never as the primary database |
| Payments | **Paystack** | Ghana-native, card + MTN/Vodafone MoMo |
| Push notifications | **Expo Notifications** | Free, no ejection needed |
| Hosting | **Render** (API + admin) + **Vercel** (student web) | See `render.yaml` + `apps/mobile/vercel.json` |
| CI/CD | **GitHub Actions** | Free, already wired up in `.github/workflows/` |
| Error monitoring | **Sentry** | 5k errors/month free |

> **Why not Supabase for the database?** Supabase's free tier pauses the Postgres instance after 7 days of inactivity — unacceptable for a live delivery platform (a quiet exam week would take the whole app offline). Wave splits the responsibility: **Neon.tech** owns the database, **Supabase** owns Auth/Storage/Realtime only. Upgrading past the free tier is a single `DATABASE_URL` swap to DigitalOcean Managed Postgres ($15/mo) — zero application code changes.

---

## Repository structure

```
wave-v2/
├── apps/
│   ├── mobile/              # React Native (Expo) — student/rider/shop app
│   │   ├── App.tsx
│   │   ├── src/
│   │   │   ├── navigation/  # React Navigation stacks
│   │   │   ├── screens/     # Per-role screens
│   │   │   ├── components/
│   │   │   ├── store/       # Zustand stores (auth, etc.)
│   │   │   ├── lib/         # Supabase client, Axios API client
│   │   │   └── hooks/
│   │   └── ...
│   └── admin/                # Next.js 14 — internal admin dashboard
│       └── src/
│           ├── app/          # App Router pages
│           ├── components/
│           └── lib/          # Supabase client, API fetch wrapper
├── packages/
│   ├── api/                  # Fastify REST API
│   │   └── src/
│   │       ├── modules/      # One folder per domain: auth, orders, shops,
│   │       │                 # products, checkpoints, payments, riders, admin
│   │       ├── plugins/      # prisma.ts, auth.ts (JWT + role guards)
│   │       └── config/       # env.ts (Zod-validated environment)
│   ├── db/                   # Prisma schema + generated client (targets Neon)
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   └── shared/                # Zod schemas + types shared by api/admin/mobile
├── supabase/
│   └── config/                # Auth + Storage + Realtime config only — NO DB migrations
├── .github/workflows/         # ci.yml, deploy-api.yml, deploy-admin.yml
├── package.json                # npm workspaces root
└── tsconfig.base.json
```

This is an **npm workspaces monorepo** — one `node_modules`, five packages (`@wave/mobile`, `@wave/admin`, `@wave/api`, `@wave/db`, `@wave/shared`) that reference each other by name.

---

## Getting started

### Prerequisites

- **Node.js 20** (see `.nvmrc` — run `nvm use` if you use nvm)
- **npm** (workspaces-based install, not pnpm/yarn)
- A [Neon.tech](https://neon.tech) account (free) for the database
- A [Supabase](https://supabase.com) project (free) for Auth/Storage/Realtime
- A [Paystack](https://paystack.com) test account for payments
- Expo Go app (iOS/Android) or a simulator, for running the mobile app

### Install

```bash
git clone https://github.com/This-Wave/wave-v2.git
cd wave-v2
npm install
```

This installs all five workspaces in one pass.

### Environment variables

Each package/app has its own `.env.example` — copy it to `.env` (API/db) or `.env.local` (admin) and fill in real values. The root `.env.example` documents every variable used across the whole stack.

```bash
cp .env.example .env                          # reference only
cp packages/db/.env.example packages/db/.env
cp packages/api/.env.example packages/api/.env
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Key variables:

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | `packages/db`, `packages/api` | **Must** point at Neon.tech (`ep-xxx.neon.tech`), never Supabase's DB |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | `packages/api`, `apps/admin`, `apps/mobile` | Auth + Storage + Realtime only |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_WEBHOOK_SECRET` | `packages/api` | Use Paystack **test** keys in development |
| `JWT_SECRET` | `packages/api` | AES key for delivery-PIN ciphertext (`orders/pinCrypto.ts`), **not** for signing JWTs — Supabase issues those. Any long random string in dev. **Rotating it makes every undelivered PIN undecryptable**, so orders in flight must be drained first; the bcrypt hash still verifies, only in-app PIN display breaks. |
| `EXPO_PUBLIC_*` | `apps/mobile` | Must be prefixed `EXPO_PUBLIC_` to be readable client-side |
| `NEXT_PUBLIC_*` | `apps/admin` | Must be prefixed `NEXT_PUBLIC_` to be readable client-side |

### Database setup

```bash
npm run db:generate    # generate the Prisma client
npm run db:migrate      # run migrations against DATABASE_URL
npm run db:seed         # seed Ashesi University + platform_config defaults
npm run db:studio       # open Prisma Studio to browse data
```

### Running the apps

```bash
npm run dev:api          # Fastify API → http://localhost:4000
npm run dev:admin        # Next.js admin → http://localhost:3000
npm run dev:mobile       # Expo dev server → scan the QR with Expo Go
```

Run them in separate terminals — the mobile app and admin dashboard both talk to the API over HTTP.

---

## Available scripts

Run from the repo root; each fans out to the relevant workspace(s).

| Script | What it does |
|---|---|
| `npm run dev:api` / `dev:admin` / `dev:mobile` | Start each app in dev mode |
| `npm run build` | Build all workspaces that have a build script |
| `npm run lint` | Lint all workspaces |
| `npm run type-check` | TypeScript check across all five workspaces |
| `npm run test:unit` | Run unit tests (Vitest, in `packages/api`) |
| `npm run test:integration` | Run integration tests against a live test database |
| `npm run db:generate` / `db:migrate` / `db:studio` / `db:seed` | Prisma workflows, see above |

---

## Testing

```bash
npm run test:unit          # discount engine, PIN generation/verification
npm run test:integration   # API + DB integration (needs TEST_DATABASE_URL)
```

Unit tests currently cover the two pieces of logic where a bug directly costs money or breaks security:

- **Discount engine** (`packages/api/src/modules/orders/discount.ts`) — loyalty discount thresholds, special-order surcharge, standard-day detection, server-side total calculation.
- **PIN verification** (`packages/api/src/modules/orders/pin.ts`) — bcrypt PIN generation and comparison.

Coverage targets (see the technical document): ≥90% unit, ≥75% integration, all critical paths covered end-to-end.

---

## Design system

Non-negotiable rules, enforced everywhere:

1. **No gradients.**
2. **No colored shadows.**
3. **No emoji.**

Brand: **Wave Green `#2EA64E`**, **Inter** typeface, **Lucide** icons, components built on **shadcn/ui** (rethemed, not rebuilt from scratch). Full design tokens and component specs live in `design.md` (kept locally, not tracked in this repo).

---

## Security

- Every protected API route runs through Supabase-JWT authentication and role-based guards (`fastify.authenticate`, `fastify.requireRole(...)`).
- Row Level Security (RLS) policies restrict data access at the database level — students can't read other students' orders, riders only see unassigned or their own orders.
- **The delivery PIN hash is never selected in any client-facing query** — see the `clientSafeOrder` select object in `packages/api/src/modules/orders/routes.ts`.
- Paystack webhook payloads are verified with an HMAC-SHA512 signature check before being trusted.
- **Order totals are always recalculated server-side** — a client-sent price is never trusted.
- All API inputs are validated with Zod schemas (`packages/shared/src/schemas/`).
- Rider ID/selfie uploads go to a private Supabase Storage bucket — no public URLs, signed URLs only, 1-hour expiry.

If you find a security issue, do not open a public GitHub issue — contact the founding team directly.

---

## Git workflow

`main` is sacred — stable, deployable code only. Never push directly to it.

| Branch | Purpose |
|---|---|
| `main` | Stable, deployed, or deployable code only |
| `develop` | Integration/staging — features merge and get tested here first |
| `feature/feature-name` | New work, branched off `develop` |
| `bugfix/bug-description` | Targeted fixes, branched off `develop` |

```
feature/my-thing → PR into develop → tested → develop → PR into main → deploy
```

---

## Deployment

**Canonical hosts (2026-08-11 pilot):**

| Service | Host | Config |
|---------|------|--------|
| **API** | Render (`render.yaml`) | Auto-deploy on push to `main` |
| **Admin** | Render (`render.yaml`) | Set `NEXT_PUBLIC_*` at **build** time |
| **Student web** | Vercel (`apps/mobile/vercel.json`) | Set `EXPO_PUBLIC_*` at build time |
| **Native app** | Expo EAS | Manual `eas build` / OTA |

Railway and Vercel admin GitHub workflows are **disabled** (checklist C9) — do not re-enable without removing Render to avoid dual deploys.

### Render API release pipeline

Each deploy runs:

1. `npm ci --include=dev`
2. `npm run build --workspace packages/api` (shared + db + API)
3. `npm run migrate:deploy --workspace @wave/db` (applies pending Prisma migrations)

Required env vars on **wave-api** (see `.env.example`):

| Variable | Notes |
|----------|--------|
| `APP_URL` | This service's public URL, with `https://` |
| `CORS_ORIGINS` | Comma-separated: admin URL + student web URL + localhost dev |
| `DATABASE_URL` | Neon pooled connection string |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` or `sk_live_…` — **not** `pk_…` |
| `SUPABASE_*`, `JWT_SECRET`, `SMS_HOOK_SECRET`, `MNOTIFY_*` | As documented in `render.yaml` |
| `SENTRY_DSN` | Optional — API error monitoring; alerts on payment/SMS failures |

**Before live Paystack:** upgrade API to a **paid always-on** Render plan (checklist C11) — free tier cold-starts can drop webhooks.

Set `NEXT_PUBLIC_SENTRY_DSN` on **wave-admin** and `EXPO_PUBLIC_SENTRY_DSN` on **student web** (Vercel) when Sentry projects exist. Configure Sentry alert rules for tags `wave.domain=payment` and `wave.domain=sms`.

**Pilot E2E:** follow [`docs/pilot-e2e-walkthrough.md`](docs/pilot-e2e-walkthrough.md) (checklist C16) on test Paystack before live keys.

**Student web (Vercel)** — set at build time:

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_API_URL` | e.g. `https://wave-api-ei19.onrender.com/v1` |
| `EXPO_PUBLIC_SUPABASE_*` | Auth client |
| `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` | `pk_test_…` matching API secret |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional crash reporting |
| `EXPO_PUBLIC_SUPPORT_EMAIL` / `WHATSAPP` | Pilot support on Profile |
| `EXPO_PUBLIC_TERMS_URL` / `PRIVACY_URL` | Legal links on signup (H11) |

**Backup:** [`docs/neon-backup-restore-runbook.md`](docs/neon-backup-restore-runbook.md) (M2).

### CI & branch protection (H8)

`.github/workflows/ci.yml` runs on PRs to `main`/`develop` and pushes to both branches (lint, type-check, unit + integration smoke tests).

In GitHub → **Settings → Branches**, require the **CI** check before merging to `main` (repo admin action).

### Local migrations

```bash
npm run db:migrate        # dev: create/apply locally
npm run db:migrate:deploy # prod-style: apply pending only
```

Workflows: `.github/workflows/ci.yml` runs lint, type-check, unit tests, and API integration smoke tests on PRs to `main`/`develop`. Deploy workflows are manual reference only.

---

## Cost model

Designed to run at **$0/month fixed cost** for the pilot (0–500 users), scaling predictably as the platform grows:

| Users | Database | API | Auth/Storage | Monthly fixed |
|---|---|---|---|---|
| 0–500 | Neon free | Render free → **paid for live** | Supabase free | **$0** pilot |
| 500–2,000 | Neon free | Render starter | Supabase free | **~$7** |
| 2,000–5,000 | DigitalOcean $15/mo | Render standard | Supabase Pro $25/mo | **~$60** |
| 5,000+ | DigitalOcean $50/mo | Render pro | Supabase Pro $25/mo | **~$125** |

Paystack transaction fees (~1.5% + ¢10/txn) apply throughout and are covered by delivery fee revenue.

---

## Roadmap

- **v1.1** — in-app chat, live rider location, ratings, shop order-arrival push notifications
- **v1.2** — wallet top-up, bulk/group orders, referral system
- **v2.0** — multi-university expansion, university-admin role, partner onboarding
- **v2.1** — shop analytics dashboard, subscription plan, rider leaderboard, dark mode

---

## Contributing

1. Branch off `develop`: `git checkout -b feature/your-feature develop`
2. Make your changes — run `npm run lint && npm run type-check && npm run test:unit` before pushing
3. Open a PR into `develop`, not `main`
4. Fill in the PR template: what changed, why, and how it was tested

---

## License

Proprietary — © Wave founding team. Not licensed for external use, redistribution, or reproduction without written permission.
