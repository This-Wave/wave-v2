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
