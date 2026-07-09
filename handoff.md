# Wave — Session Handoff
**Session:** 3 (Monorepo Scaffold)
**Completed by:** Claude Sonnet 5
**Date:** 2026-07-09

---

## State of the Project

Wave now has a working, installed, type-checked monorepo scaffold. No screens or endpoints are wired to a real Neon/Supabase project yet — that's the next session's job — but the full folder structure, Prisma schema, Fastify API modules (with working discount/PIN logic and passing unit tests), Next.js admin shell, and Expo mobile shell all exist and build cleanly. Git branching is in place: `main` has the scaffold commit, `develop` is checked out and matches `main`.

---

## What Was Done This Session

- Scaffolded the full npm-workspaces monorepo per `Wave_Technical_Document.md` Section 15.1: `apps/mobile`, `apps/admin`, `packages/api`, `packages/db`, `packages/shared`.
- Wrote the complete Prisma schema (`packages/db/prisma/schema.prisma`) covering all 10 tables from Section 7, targeting `DATABASE_URL` (Neon.tech) — generated the Prisma client successfully.
- Added a seed script (`packages/db/prisma/seed.ts`) that creates the Ashesi University row and seeds `platform_config` defaults.
- Built `packages/shared`: Zod schemas for auth, orders, shops/products, checkpoints, riders, admin — shared across api/admin/mobile.
- Built `packages/api` (Fastify): env validation, Prisma + Supabase-auth plugins, and route modules for auth (register/login/refresh/logout), profiles, universities/checkpoints, shops, products, orders, payments (Paystack init + webhook with signature verification), riders (verification + earnings + availability), admin (stats/users/config/refund).
- Implemented the discount engine, PIN generation/verification, and server-side order total calculation — copied the exact test cases from Section 12 of the tech doc into `packages/api/src/modules/orders/__tests__/` and **all 11 pass**.
- Scaffolded `apps/admin` (Next.js 14 App Router + Tailwind, Wave Green theme token, Supabase auth client, thin API fetch wrapper).
- Scaffolded `apps/mobile` (Expo + NativeWind + React Navigation + Zustand auth store + Axios client with auth interceptor + a Welcome screen).
- Added `.github/workflows/ci.yml`, `deploy-api.yml` (Railway), `deploy-admin.yml` (Vercel).
- Added `supabase/config/README.md` and `supabase/seed-auth.sql` placeholders (Auth/Storage/Realtime only, no DB migrations — per ADR-002).
- Ran `npm install` (1539 packages, clean), generated the Prisma client, and type-checked all five workspaces (`@wave/db`, `@wave/shared`, `@wave/api`, `@wave/admin`, `@wave/mobile`) — all clean.
- Made the initial git commit on `main`, then created and checked out `develop` per the branching strategy.

---

## What Is In Progress / Incomplete

- No Neon.tech project created yet — `DATABASE_URL` in every `.env.example` is a placeholder.
- No Supabase project created yet — Auth/Storage/Realtime are stubbed but unconfigured.
- No Railway/Vercel projects created yet — the deploy workflows reference secrets (`RAILWAY_TOKEN`, `VERCEL_TOKEN`, etc.) that don't exist yet.
- Auth routes are written against the Supabase Admin API but have never run against a real project — expect first-run bugs (e.g. `phone_confirm` behavior, RLS policies not yet applied).
- RLS policies from Section 10.2 are **not yet applied** — they only exist as SQL examples in the tech doc. Must be applied directly in the Supabase/Neon dashboard or via a migration once a real DB exists.
- Mobile app only has a placeholder `WelcomeScreen` — no auth screens, no navigators per role yet.
- Admin dashboard only has a placeholder landing page — no login, no data views yet.
- Integration tests (`vitest run src/**/*.integration.test.ts`) have no test files yet — they require a live test database.

---

## What the Next Session Should Do First

1. **Read this handoff, `debug.md` (especially the NativeWind type-augmentation gotcha below), and `Wave_Technical_Document.md` Section 7 + Section 10.**
2. Create the actual Neon.tech project, run `npm run db:migrate` from root (`packages/db`) against it, then `npm run db:seed`.
3. Create the Supabase project (Auth + Storage + Realtime only), fill in real values in each package's `.env` (copy from `.env.example`), and apply the RLS policies from Section 10.2 directly in the Supabase SQL editor.
4. Smoke-test `POST /v1/auth/register` and `/v1/auth/login` against the real Supabase project — this is the first code that has never actually run end-to-end.
5. Start on the Phase 1 remainder: profile creation screens (mobile), admin user list + rider verification queue (admin dashboard).

---

## Critical Things to Know

- Everything from the prior handoff still applies (Supabase ≠ database, Paystack pesewas, PIN hash never exposed, 24h special-order lead time, discount on delivery fee only). Not repeated here — see `debug.md`.
- **New gotcha this session:** NativeWind v2 + Expo 51's bundled React Native types don't merge via `/// <reference types="nativewind/types" />` in this setup — it silently fails to augment `ViewProps`/`TextProps`/etc. with `className`, producing `TS2769` errors on every NativeWind-styled component. Fixed by writing the `declare module "react-native" { ... }` augmentation directly in `apps/mobile/nativewind-env.d.ts` instead of relying on the triple-slash reference. See `debug.md` for the full writeup.
- The API's `clientSafeOrder` Prisma `select` object in `packages/api/src/modules/orders/routes.ts` is the enforcement point for GOTCHA-003 (PIN hash never leaves the server) — any new order-returning route must reuse this select, not `include`/`findMany` without a select.
- `packages/api/src/plugins/auth.ts` decorates Fastify with `authenticate` and `requireRole(...)` — every protected route in every module uses these as `preHandler`. Keep that pattern for new routes.
- Root `package.json` scripts assume npm workspaces (not pnpm/turborepo) — `npm run dev:api`, `dev:admin`, `dev:mobile`, `db:migrate`, `db:seed`, etc. all exist and route to the right workspace.

---

## Files Modified This Session

- None from prior sessions — this session only added new files (see below) and appended to the four session-tracking files + today's devlogs.

---

## Files Created This Session

- Root: `package.json`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.nvmrc`, `.env.example`
- `packages/db/`: `package.json`, `tsconfig.json`, `.env.example`, `prisma/schema.prisma`, `prisma/seed.ts`, `src/index.ts`
- `packages/shared/`: `package.json`, `tsconfig.json`, `src/constants/platform.ts`, `src/schemas/{auth,order,shop,checkpoint,rider,admin}.ts`, `src/types/index.ts`, `src/index.ts`
- `packages/api/`: `package.json`, `tsconfig.json`, `.env.example`, `vitest.config.ts`, `src/{app.ts,index.ts}`, `src/config/env.ts`, `src/plugins/{auth,prisma}.ts`, `src/modules/{auth,profiles,checkpoints,shops,products,orders,payments,riders,admin}/routes.ts`, `src/modules/orders/{discount,pin}.ts` + `__tests__`
- `apps/admin/`: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `.env.example`, `src/app/{layout,page,globals.css}`, `src/lib/{supabase,api}.ts`
- `apps/mobile/`: `package.json`, `app.json`, `babel.config.js`, `tailwind.config.js`, `tsconfig.json`, `.env.example`, `nativewind-env.d.ts`, `App.tsx`, `global.css`, `src/navigation/RootNavigator.tsx`, `src/screens/WelcomeScreen.tsx`, `src/lib/{supabase,api}.ts`, `src/store/authStore.ts`
- `.github/workflows/`: `ci.yml`, `deploy-api.yml`, `deploy-admin.yml`
- `supabase/config/README.md`, `supabase/seed-auth.sql`

---

## Open Questions / Decisions Needed

Carried over from Session 1, unresolved — still need founder decisions before building further:
- Rider payout amount (flat fee, % of delivery fee, or configurable?).
- Student registration: self-reported vs. actual Ashesi enrollment verification.
- Special order lead time: keep hardcoded 24h (currently how it's built) or move to `platform_config` (recommended — would need one small schema/route change).
- Shop onboarding: manual (founder-onboarded) vs. self-registration flow.
