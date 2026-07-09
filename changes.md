# Wave — Changes Log

> Chronological record of everything built, changed, fixed, or removed across all sessions.

---

## Session 1 — June 2026 (Foundation & Documentation)

### Added
- `Wave_Technical_Document.md` v1.0.0 — full 16-section technical specification
- `design.md` v1.0.0 — initial design system
- `claude.md` — permanent session protocol
- `handoff.md`, `sessionlog.md`, `debug.md`, `changes.md` — session tracking files

### Changed
- Technical document v1.0.0 → v1.1.0: Neon.tech replaces Supabase DB, DigitalOcean upgrade path documented
- Technical document v1.1.0 → v1.2.0: Design System added as Section 11, sections renumbered

---

## Session 2 — June 2026 (Design System Refinement + Prototype Prompt)

### Changed
- `design.md` v1.0.0 → v1.1.0: Visual Reference section added, segment controls, radio rows, expanded bottom sheet and nav specs, skeleton shimmer labelled as only permitted gradient
- Technical document v1.2.0 → v1.3.0: Design System section rewritten to reference design.md as source of truth
- Prototype prompt rewritten — leaner, image-led (see below)

---

## Wave App — Prototype Prompt
### For: Claude Design

---

Look at the attached images. That is Wave.

Build a complete, multi-screen mobile app prototype that looks exactly like what you see in those images — same quality, same layout sensibility, same feel. The app is called Wave and it's a campus delivery service for university students in Ghana. Students order items from off-campus shops, riders pick them up and deliver to campus drop-off points, and shops manage their own menus and incoming orders.

The attached images are your design brief. Everything — spacing, card style, typography weight, color use, navigation pattern, list rows, bottom sheets, status indicators — should come from studying those images, not from convention or assumption.

Use shadcn/ui as the component foundation throughout. Retheme it with Wave Green (`#2EA64E`) as the primary color. Inter for all text. Lucide icons everywhere.

Three things that must never appear, no matter what:
- Gradients
- Colored shadows
- Emoji

Cover all three user roles — Student, Rider, Shop — and an Admin web view. Design as many screens as it takes to tell a complete, coherent story for each role. Don't stop at the obvious screens; include the transitions, the empty states, the confirmation moments, anything that makes it feel like a real product someone built with care.

The images are attached. Start there.

---

## Session 3 — 2026-07-09 (Monorepo Scaffold)

### Added
- Root npm-workspaces monorepo: `package.json`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.nvmrc`, `.env.example`
- `packages/db` — full Prisma schema (10 models) targeting Neon.tech, seed script for Ashesi University + `platform_config` defaults
- `packages/shared` — Zod schemas for auth, orders, shops/products, checkpoints, riders, admin; shared constants and types
- `packages/api` — Fastify app: env validation, Prisma + Supabase-auth plugins, route modules for auth/profiles/checkpoints/shops/products/orders/payments/riders/admin; discount engine, PIN generation/verification, server-side order total calculation, Paystack init + webhook signature verification
- `packages/api` unit tests — discount engine (9 tests) and PIN verification (2 tests), matching `Wave_Technical_Document.md` Section 12.2 exactly; all 11 pass
- `apps/admin` — Next.js 14 App Router scaffold, Tailwind with Wave Green token, Supabase auth client, API fetch wrapper
- `apps/mobile` — Expo scaffold with NativeWind, React Navigation, Zustand auth store, Axios client with auth interceptor, placeholder Welcome screen
- `.github/workflows/{ci,deploy-api,deploy-admin}.yml`
- `supabase/config/README.md`, `supabase/seed-auth.sql` (Auth/Storage/Realtime only, no DB migrations)

### Changed
- N/A — first code commit to the repository

### Fixed
- NativeWind `className` typing not merging via triple-slash reference — see `debug.md`

### Removed
- N/A

### Notes
- Initial `git commit` made on `main` (94 files), followed by a small fix commit removing an accidentally-committed `tsconfig.tsbuildinfo`. `develop` branch created off `main` per the branching strategy — all future feature work should branch from `develop`.
- No live Neon/Supabase/Railway/Vercel projects connected yet — every `.env.example` is a placeholder. `npm install`, `prisma generate`, and `type-check` all pass across all five workspaces.

---
