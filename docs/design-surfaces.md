# Wave — Two surfaces, one palette

**Last updated:** 2026-08-25
**Why this exists:** review 04-ux-design, H4 and L1 — the admin dashboard and the
student app look different in specific ways, and nothing in the repo said whether
that was a decision or drift. It is a decision. This is the record of it.

`CLAUDE.md` remains the authority on the v6 rules themselves. This file only covers
where the two surfaces deliberately differ, and why.

---

## What is shared, and is not negotiable

Both surfaces use the same v6 core. None of this may diverge:

| Token | Value | Notes |
|-------|-------|-------|
| ink | `#083400` | All text and icon strokes. ~15.6:1 on white |
| lime | `#87ea5c` | **Fill only, never text.** White on lime is ~1.8:1 and fails WCAG, so it always carries ink on top |
| canvas | `#f7f7f7` | |
| card | `#ffffff` | |
| muted | `#6a6a6a` | |
| hairline | `#ebebeb` | |
| Radii | card 12px · input 8px · pill 9999px | Three only |

Also shared, and also not negotiable: **no gradients, no colored shadows, no emoji.**

Primary CTA on both surfaces is a lime pill with an ink label.

---

## Where they deliberately differ

### 1. Cards: student has no border and no shadow; admin has both

**Student** (`apps/mobile/tailwind.config.js`, `src/components/v6/`)
Cards are white on the `#f7f7f7` canvas and separated by value contrast alone.
Shadow is reserved for exactly two things: the home search capsule and sheets.

**Admin** (`apps/admin/tailwind.config.js`, `src/components/ui/Card.tsx`)
Cards carry a hairline border and a neutral `shadow-card`.

**Why.** The student app is a single column on a small screen, where one card is
usually the only thing you are looking at — a border around it is decoration that
adds nothing, and the reserved shadow makes the search capsule read as *the* action
on the home screen. The admin dashboard puts many cards and dense tables side by side
on a wide display, where value contrast alone stops resolving and adjacent panels
start to bleed into each other. The border is doing structural work there that it
would not be doing on a phone.

The rule to carry forward: **elevation earns its place by disambiguating adjacent
regions.** On a phone there usually are no adjacent regions.

### 2. Typeface: student is DM Sans; admin is Geist

**Student** — DM Sans, named in the v6 reference as the substitute for Airbnb Cereal.
**Admin** — Geist, loaded from Google Fonts in `apps/admin/src/app/layout.tsx`.

**Why.** These are different products for different people. Students see a consumer
app and DM Sans carries the warmth that calls for. The admin dashboard is an internal
operations tool that is mostly numbers, references, and tabular data, and Geist's
tighter figures hold a column better. Nobody uses both surfaces in the same sitting,
so the mismatch is never actually seen side by side.

**Do not** "fix" this by unifying them without reading the paragraph above first.
It has been considered.

### 3. Density

Admin runs tighter padding and smaller type in tables. A shop's whole order history
should fit on one screen for someone triaging it; a student is reading one order at a
time with a thumb.

---

## Adding something new

1. **Colour** — use the shared tokens. If you reach for a hex literal, stop; that is
   how the three-palette mess in the original review happened.
2. **Radius** — one of the three. There is no fourth.
3. **Elevation** — on student, assume none unless it is the search capsule or a
   sheet. On admin, match the surrounding cards.
4. **Lime** — fill only. If you have written lime text, it fails contrast. Use ink.

---

## Known remaining drift

- No Reanimated in the mobile app; the desktop web panel uses basic CSS motion.
  Acceptable for the pilot, listed in review 04 as open.
- Admin has no dark mode. Neither does student. Not planned for the pilot.
