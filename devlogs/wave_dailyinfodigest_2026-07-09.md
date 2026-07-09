# wave — dailyinfodigest — 2026-07-09

## Git Branching Strategy

We set up a rule that `main` is only for stable, deployable code — like a published book, not a rough draft. New work happens on named branches (`feature/...` or `bugfix/...`), gets merged into `develop` for testing, and only reaches `main` when it's ready to ship. This keeps production from breaking when someone is mid-task.

## Devlog Automation

We installed a system that writes two daily logs at the end of each coding session. **mydailywork** is the engineer's notebook — terse facts about what changed. **dailyinfodigest** explains the same work in plain English for someone learning the project. The instructions live in three places (`claude.md`, a Cursor rule, and `devlogs/DEVLOG_PROMPT.md`) so the AI agent follows them automatically without you having to ask each time.

## Cursor Rules

Cursor can inject permanent instructions into every chat via `.cursor/rules/*.mdc` files. Setting `alwaysApply: true` means the agent sees those rules on every turn — useful for things like "never push to main" and "update the devlog before you finish."
