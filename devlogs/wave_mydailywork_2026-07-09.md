# wave — mydailywork — 2026-07-09

## Git & Branching

- Added Git branching rules to `claude.md` (`main`, `develop`, `feature/*`, `bugfix/*`, workflow steps).
- Created `.cursor/rules/git-branching.mdc` with `alwaysApply: true`.
- Updated `Wave_Technical_Document.md` §14.4 to match (replaced `staging`/`dev`/`fix/*` with `develop`/`bugfix/*`).

## Devlog Automation

- Created `devlogs/DEVLOG_PROMPT.md` as source of truth (project slug: `wave`).
- Created `.cursor/rules/devlog-updates.mdc` with `alwaysApply: true`.
- Pasted devlog prompt into `claude.md` under "Daily Devlogs (required closing step)".
- Updated project file map in `claude.md` to include `devlogs/`.

## Monorepo Scaffold

- Created npm-workspaces monorepo: `apps/{mobile,admin}`, `packages/{api,db,shared}`, root `package.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`, `.editorconfig`, `.env.example`.
- `packages/db`: full `prisma/schema.prisma` (10 models matching `Wave_Technical_Document.md` §7), `prisma/seed.ts` (Ashesi University + `platform_config` defaults). `npx prisma generate` succeeded.
- `packages/shared`: Zod schemas — `schemas/{auth,order,shop,checkpoint,rider,admin}.ts`, `constants/platform.ts`, `types/index.ts`.
- `packages/api`: Fastify app (`app.ts`, `index.ts`), env validation (`config/env.ts`), `plugins/{prisma,auth}.ts` (decorates `authenticate`/`requireRole`), route modules under `modules/{auth,profiles,checkpoints,shops,products,orders,payments,riders,admin}/routes.ts`. Order module includes `discount.ts` (discount engine, order total calc, standard-day check) and `pin.ts` (bcrypt PIN gen/verify). Payments module includes Paystack init + HMAC-SHA512 webhook signature verification.
- Wrote `packages/api/src/modules/orders/__tests__/{discount,pin}.test.ts` using the exact test cases from `Wave_Technical_Document.md` §12.2 — `npx vitest run` → 11/11 pass.
- `apps/admin`: Next.js 14 App Router, `tailwind.config.ts` with `wave` color scale (`#2EA64E` base), `src/lib/{supabase,api}.ts`.
- `apps/mobile`: Expo + NativeWind, `src/navigation/RootNavigator.tsx`, `src/screens/WelcomeScreen.tsx`, `src/store/authStore.ts` (Zustand), `src/lib/{supabase,api}.ts` (Axios with auth interceptor).
- `.github/workflows/{ci,deploy-api,deploy-admin}.yml`; `supabase/config/README.md`, `supabase/seed-auth.sql`.
- Fixed NativeWind `TS2769` type errors on `className` prop — see Debugging section below.
- `npm install` at root: 1539 packages, no errors. Type-checked all 5 workspaces (`db`, `shared`, `api`, `admin`, `mobile`) — all clean after the NativeWind fix.
- Removed an accidentally-committed `apps/admin/tsconfig.tsbuildinfo`, added `*.tsbuildinfo` to `.gitignore`.

## Git & PRs

- No prior commits existed on this repo. Made the initial commit on `main` (94 files: full monorepo scaffold), then a follow-up commit for the `.tsbuildinfo` fix.
- Created and checked out `develop` off `main`, per the branching rule already documented in `claude.md` / `.cursor/rules/git-branching.mdc`.

## Debugging

- `apps/mobile` type-check failed with `TS2769` on every `className`-using RN component (`SafeAreaView`, `View`, `Text`). NativeWind's documented fix (`/// <reference types="nativewind/types" />`) resolved the file (confirmed via `tsc --listFiles`) but the `declare module "react-native"` augmentation didn't merge. Fixed by writing the same augmentation inline in `apps/mobile/nativewind-env.d.ts` instead of referencing it. Logged in `debug.md`.
