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
