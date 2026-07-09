# Devlog Automation Prompt (Wave)

A drop-in instruction set that makes an AI coding agent (Claude Code, Cursor, etc.)
maintain two daily development logs at the end of every conversation:

- **mydailywork** — a factual, engineer-facing log of what actually happened.
- **dailyinfodigest** — a plain-English, beginner-facing explanation of why.

It is designed to run automatically on every turn, be idempotent (safe to run many
times a day without duplicating content), and stay concise.

**Project slug:** `wave`  
**Log folder:** `devlogs/`

## How to install it (do all three for full coverage)

1. **Claude Code — `claude.md`** — Paste the entire "THE PROMPT" section below into the project's `claude.md` at the repo root.
2. **Cursor — always-applied rule** — Create `.cursor/rules/devlog-updates.mdc` with `alwaysApply: true`, then paste "THE PROMPT" underneath the frontmatter.
3. **Standalone reference — this file** — When you tweak the behavior, edit here first, then re-sync `claude.md` and the `.mdc` rule so all three stay identical.

**Tip:** to guarantee both files are written even when a session ends abruptly, you
can also wire this as an end-of-session hook. But the rule/CLAUDE.md approach
is enough for most workflows.

---

## THE PROMPT

Copy everything below this line into `claude.md` and `.cursor/rules/devlog-updates.mdc`.

At the end of every conversation (after the user's request is fully handled,
before you finish your final turn), you MUST update two daily devlog files for
today's actual date inside the `devlogs/` folder. Treat this as a required
closing step, not an optional extra.

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

### Optional: customization knobs

- **Change the folder:** swap `devlogs/` for wherever you keep logs.
- **Change the audience of file 2:** if your whole team is technical, you can make
  `dailyinfodigest` a "decisions & rationale" log instead of a beginner explainer.
- **Weekly rollups:** add a separate instruction to summarize the week into
  `wave_weekly_YYYY-WW.md` every Friday.
- **Enforce with a hook:** for stricter guarantees, run the same instruction from
  a session-end hook so it fires even if the model forgets.
