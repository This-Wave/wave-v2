# Wave — Session Handoff
**Session:** 1 (Foundation & Documentation)
**Completed by:** Claude Sonnet 4.6
**Date:** June 2026

---

## State of the Project

Wave is in the **pre-development documentation phase**. All core project documents have been created and are stable. No application code has been written yet — this session was entirely about establishing the technical foundation, design system, and project scaffolding documents. The project is ready to begin Phase 1 development (monorepo setup, auth, profiles).

---

## What Was Done This Session

- Created the full **Wave Technical Specification** (`Wave_Technical_Document.md` v1.2.0) covering all 16 sections: executive summary, product overview, roles, feature specs, tech stack, architecture, DB schema, API design, integrations, security, design system, testing strategy, timeline, cost analysis, DevOps, and roadmap.
- Established and documented the **database architecture decision**: Neon.tech for PostgreSQL (no pausing), Supabase retained only for Auth + Storage + Realtime.
- Added the **DigitalOcean Managed PostgreSQL ($15/mo)** upgrade path documentation with one-env-var migration instructions.
- Created the full **Design System** (`design.md` v1.0.0) with color tokens, type scale, spacing, all component specs, screen inventory, motion rules, skeleton loading specs, and accessibility requirements.
- Created **`claude.md`** — the permanent session protocol file every future Claude run must read first.
- Created **`handoff.md`**, **`sessionlog.md`**, **`debug.md`**, **`changes.md`** as the four mandatory session tracking files.
- Established **design commandments**: no gradients, no colored shadows, no emoji, Wave Green (`#2EA64E`) is functional-only.

---

## What Is In Progress / Incomplete

- No application code exists yet — all documentation only.
- Figma/prototype designs have not been created yet (prompt was written, see `changes.md`).
- No Neon.tech project created yet.
- No Supabase project created yet.
- No Railway project created yet.
- No GitHub repository created yet.

---

## What the Next Session Should Do First

1. **Read** this handoff.md, `Wave_Technical_Document.md` Section 5 (Tech Stack) and Section 7 (DB Schema), and `design.md`.
2. **Scaffold the monorepo** using the structure in Section 14.1 of the technical document:
   ```
   wave/
   ├── apps/mobile/
   ├── apps/admin/
   ├── packages/api/
   ├── packages/db/
   └── packages/shared/
   ```
3. **Initialize Prisma** in `packages/db/` with the schema from Section 7 targeting Neon.tech.
4. **Set up Fastify** in `packages/api/` with TypeScript, Zod, and Supabase Auth JWT middleware.
5. **Implement `/auth/register` and `/auth/login`** endpoints — all roles (student, rider, shop_owner, admin).
6. Check `debug.md` first — it is empty but good practice.

---

## Critical Things to Know

- **Supabase is NOT the database.** Supabase = Auth + Storage + Realtime only. Neon.tech = PostgreSQL. A future session that tries to use Supabase DB will break the architecture.
- **DATABASE_URL** in `.env` must point to Neon.tech: `postgresql://user:pass@ep-xxx.neon.tech/wave?sslmode=require`
- The commented-out DigitalOcean URL is intentional — it's the migration path, not current.
- **Paystack** uses **pesewas** (smallest unit), not cedis — amounts must be multiplied by 100.
- **Wave Green = `#2EA64E`** — hardcoded, never change this. It is the brand color.
- The `delivery_pin_hash` column in the `orders` table is NEVER exposed to clients — RLS policy strips it.
- Special orders need 24-hour advance notice — enforce server-side, not just client-side.
- Discount (20%) applies to **delivery fee only**, NOT item price.

---

## Files Modified This Session

- `Wave_Technical_Document.md` — Updated from v1.0.0 → v1.2.0. Added Design System (Section 11), renumbered subsequent sections, updated database stack to Neon+Supabase split, added DigitalOcean upgrade path.

---

## Files Created This Session

- `design.md` — Complete design system reference (v1.0.0)
- `claude.md` — Permanent session protocol file
- `handoff.md` — This file
- `sessionlog.md` — Session 1 log
- `debug.md` — Debug log (empty, no issues yet)
- `changes.md` — Changelog (Session 1 entries)

---

## Open Questions / Decisions Needed

- **Rider payout amount:** Not specified in current document. How much does a rider earn per delivery? Is it a flat fee, a percentage of delivery fee, or configurable per order? → Needs founder decision before building rider earnings module.
- **Student registration:** Does Wave verify that a student is actually enrolled at Ashesi? Or is it self-reported? → Affects profile schema (student ID verification flow needed or not).
- **Special order minimum lead time:** Document says 24 hours. Should this be configurable in `platform_config` or hardcoded? → Recommendation: add to `platform_config` table.
- **Shop onboarding:** Are shops onboarded manually by the Wave team (at launch), or do shop owners self-register? → Affects whether `is_verified` for shops needs admin approval flow identical to riders.
