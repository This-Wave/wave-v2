# claude.md — Wave Project Session Protocol

> This file must be read at the START of every Claude session working on the Wave project.
> After every session, Claude must generate or update the four session files below.
> This protocol ensures continuity across sessions, catches regressions, and makes the project auditable.

---

## What This Project Is

**Wave** is a mobile-first campus delivery app for Ghanaian universities, piloting at Ashesi University.
- Students place "Buy For Me" orders from off-campus shops.
- Riders pick up and deliver to campus checkpoints.
- Shop owners manage their storefronts and incoming orders.
- Payment via Paystack (card + MTN/Vodafone MoMo).

**Read before doing anything:**
1. `Wave_Technical_Document.md` — full product spec, tech stack, schema, API, timeline
2. `design.md` — design system, tokens, component specs, screen inventory
3. `handoff.md` (if it exists) — what the previous session did and what this session needs to know
4. `changes.md` (if it exists) — full changelog of what has been built/changed

---

## Session Rules

### Before writing any code or making any changes:
- Read `handoff.md` fully.
- Read the relevant sections of `Wave_Technical_Document.md`.
- Read `design.md` fully if working on UI/frontend.
- Check `debug.md` for known issues before attempting anything that previously failed.

### Design rules (non-negotiable):
- **No gradients.**
- **No colored shadows.**
- **No emoji.**
- **Wave Green = `#2EA64E`** — the brand primary color.
- **Components = shadcn/ui** rethemed to Wave. Not rebuilt from scratch.
- All other design decisions defer to `design.md` and the reference images.

### Tech rules:
- Database = **Neon.tech PostgreSQL 16** (never Supabase DB — it pauses).
- Auth / Storage / Realtime = **Supabase** (does NOT pause).
- Backend = **Fastify + TypeScript** on Railway.
- Mobile = **React Native (Expo)**.
- Admin = **Next.js 14** on Vercel.
- ORM = **Prisma** targeting Neon connection string.
- Payments = **Paystack** (Ghana-native, MoMo + card).

### Code rules:
- TypeScript strict mode everywhere.
- Zod schemas for all API input validation.
- All DB queries through Prisma (never raw SQL in application code).
- Paystack webhook signature MUST be verified before processing.
- PINs stored as bcrypt hashes — never plaintext.
- Never trust client-sent price — always recalculate server-side.

### Git & branching rules:
Never push code directly to `main`. Use this branching strategy to keep production stable.

| Branch | Purpose |
|--------|---------|
| `main` | Sacred. Stable, deployed, or deployable code only. |
| `develop` | Integration/staging — features are merged and tested here before `main`. |
| `feature/feature-name` | New work. Branch off `develop` (or `main` for hotfix-only cases). Example: `feature/user-authentication`. |
| `bugfix/bug-description` | Targeted fixes. Example: `bugfix/login-crash`. |

**Workflow:**
1. Branch from `develop` for new features or bug fixes.
2. Open a PR into `develop` when the work is ready for integration testing.
3. Merge `develop` into `main` only when the release is stable and deployable.
4. Do not commit or push directly to `main` unless explicitly instructed for an emergency hotfix.

---

## After Every Session — Required File Outputs

Claude MUST produce or update all four files below at the end of every session.
Partial sessions still require all four files — just note what was incomplete.

---

### 1. handoff.md

**Purpose:** Tell the next session exactly what it needs to know to continue without confusion.

**Template:**
```markdown
# Wave — Session Handoff
**Session:** [number or date]
**Completed by:** Claude [model name if known]
**Date:** [date]

## State of the Project
[2-3 sentences on overall project status]

## What Was Done This Session
- [bullet list of concrete completed tasks]

## What Is In Progress / Incomplete
- [anything started but not finished, with exact state]

## What the Next Session Should Do First
1. [ordered list of immediate next actions]

## Critical Things to Know
- [any gotchas, workarounds, decisions made, API quirks discovered]

## Files Modified This Session
- [filename]: [what changed]

## Files Created This Session
- [filename]: [what it is]

## Open Questions / Decisions Needed
- [anything that needs a human decision before proceeding]
```

---

### 2. sessionlog.md

**Purpose:** A chronological record of everything that happened in the session.

**Template:**
```markdown
# Wave — Session Log
**Session:** [number or date]
**Date:** [date]
**Duration:** [estimated]

## Session Goals
[What we set out to do]

## Chronological Log

### [Time or step label]
[What happened, what was decided, what was built]

### [Time or step label]
[Continue...]

## Decisions Made
| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| ...      | ...       | ...                    |

## Code / Files Produced
[List with brief description of each]

## Tests Run
[What was tested, results]

## End State
[Exactly where things were left]
```

---

### 3. debug.md

**Purpose:** Document every error, bug, or unexpected behavior — what went wrong, why, and exactly how it was fixed.

**Template:**
```markdown
# Wave — Debug Log

## Active Issues
[Issues not yet resolved]

---

## Resolved Issues

### [Issue Title]
**Session:** [when this occurred]
**Severity:** Critical / High / Medium / Low
**Symptom:** [What was observed]
**Root Cause:** [Why it happened]
**Fix Applied:** [Exactly what was changed to fix it]
**Files Changed:** [list]
**Prevention:** [How to avoid this in future]

---
```

---

### 4. changes.md

**Purpose:** A clean, human-readable changelog of everything that has been built or changed, organized by session/version.

**Template:**
```markdown
# Wave — Changes Log

## [Session N] — [Date]

### Added
- [New feature or file]

### Changed
- [Modified behavior or file]

### Fixed
- [Bug resolved]

### Removed
- [Deleted code or feature]

### Notes
- [Anything else worth logging]

---
```

---

## Project File Map

```
wave-project/
├── Wave_Technical_Document.md   ← Full spec (tech stack, schema, API, timeline)
├── design.md                    ← Design system (tokens, components, screens)
├── claude.md                    ← This file (session protocol)
├── handoff.md                   ← What the next session needs to know
├── sessionlog.md                ← What happened this session
├── debug.md                     ← Bugs and fixes
├── changes.md                   ← Changelog
└── devlogs/                     ← Daily devlogs (mydailywork + dailyinfodigest)
    └── DEVLOG_PROMPT.md         ← Source of truth for devlog automation
```

---

## Quick Reference

### Key Numbers
- Pilot university: Ashesi University, Berekuso, Ghana
- Standard delivery days: Sunday + Wednesday (no surcharge)
- Special order surcharge: 30% on delivery fee
- Loyalty discount: 20% off delivery fee after 6 completed deliveries
- Delivery PIN: 6-digit numeric, bcrypt hashed, sent via push notification
- Base delivery fee: GHS 5.00

### Key External Services
| Service     | What for                          | Free tier |
|-------------|-----------------------------------|-----------|
| Neon.tech   | PostgreSQL database               | 0.5GB, never pauses |
| Supabase    | Auth + Storage + Realtime         | 1GB storage |
| Railway     | Fastify API hosting               | 500hrs/mo |
| Vercel      | Admin dashboard                   | Unlimited hobby |
| Paystack    | Payments (card + MoMo)            | % per transaction |
| Expo EAS    | App builds + OTA                  | Limited free |
| Sentry      | Error monitoring                  | 5k errors/mo |

---

## Daily Devlogs (required closing step)

At the end of every conversation (after the user's request is fully handled,
before you finish your final turn), you MUST update two daily devlog files for
today's actual date inside the `devlogs/` folder. Treat this as a required
closing step, not an optional extra.

**Source of truth:** `devlogs/DEVLOG_PROMPT.md` — edit there first, then re-sync this section and `.cursor/rules/devlog-updates.mdc`.

### Step 0 — Always confirm the real date first

- Run `date +%Y-%m-%d` (or the platform equivalent) to get today's date.
- Never assume the date, reuse yesterday's date, or copy a date from an
  earlier file. A wrong date silently splinters the log across files.

### The two files

Naming (create them if they don't exist yet):

- `wave_mydailywork_YYYY-MM-DD.md`
- `wave_dailyinfodigest_YYYY-MM-DD.md`

Both live in `devlogs/`.

### File 1 — mydailywork (the factual engineering log)

Audience: a developer (you, future-you, or a teammate) who wants a precise record
of what changed and why it changed.

**Structure:**

- Organize by task / feature area, one named `##` section each
  (e.g. `## Inventory`, `## POS`, `## Auth`, `## Git & PRs`).
- Inside each section, capture the concrete facts:
  - what was changed/added/removed (files, components, endpoints)
  - errors or failures hit, and exactly how they were fixed
  - decisions made and any follow-ups still pending
- If a section for that area already exists in today's file, append to it —
  never create a second section for the same area.
- If the work fits no existing section, create a new, accurately-named one.
- Never file work under an unrelated section just because it was written last.

**Style:**

- One line per change. Be terse and specific. Prefer
  `- Fixed empty-seed crash in PersonAvatar (falls back to "anonymous")`
  over a paragraph.
- Use backticks for file/function/component names.

### File 2 — dailyinfodigest (the teach-it-back digest)

Audience: a non-technical reader who wants to understand why today's work
mattered and learn the concepts behind it.

**Structure:**

- Organize by topic / concept area, one named `##` section each
  (e.g. `## Deterministic Avatars`, `## Stacked Pull Requests`, `## React State`).
- Each section explains the WHY: why the error happened, why this fix works,
  why it was built this way.
- If a topic section already exists today, append to it; otherwise create a new
  named one. Never bolt a new concept onto an unrelated section.

**Style:**

- Plain English, friendly tone, assume no prior knowledge.
- At most one analogy per concept, and keep it short.
- One short paragraph per concept — don't sprawl.
- If you keep a glossary, each definition is a single clause.

### Global rules (apply to both files)

- Read today's file first (if it exists) so you append to the correct section
  instead of duplicating or misfiling.
- Group by task/topic — never dump everything at the bottom under whatever
  section happened to be last.
- Only record what's genuinely new or worth keeping. Skip trivia (reading a
  file that revealed nothing, restating something already logged today).
- Append, never overwrite. Do not delete or rewrite existing entries; only
  add to the right section.
- Don't repeat content already written for the same day.
- Be concise — this is a log, not documentation. Density beats prose.
- If truly nothing meaningful happened, it's fine to add nothing rather than pad
  the log.

---

*This file is permanent and should never be deleted or overwritten — only the session files (handoff, sessionlog, debug, changes) and daily devlogs get updated each run.*
