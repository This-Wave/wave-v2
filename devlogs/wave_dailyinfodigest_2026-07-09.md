# wave — dailyinfodigest — 2026-07-09

## Git Branching Strategy

We set up a rule that `main` is only for stable, deployable code — like a published book, not a rough draft. New work happens on named branches (`feature/...` or `bugfix/...`), gets merged into `develop` for testing, and only reaches `main` when it's ready to ship. This keeps production from breaking when someone is mid-task.

## Devlog Automation

We installed a system that writes two daily logs at the end of each coding session. **mydailywork** is the engineer's notebook — terse facts about what changed. **dailyinfodigest** explains the same work in plain English for someone learning the project. The instructions live in three places (`claude.md`, a Cursor rule, and `devlogs/DEVLOG_PROMPT.md`) so the AI agent follows them automatically without you having to ask each time.

## Cursor Rules

Cursor can inject permanent instructions into every chat via `.cursor/rules/*.mdc` files. Setting `alwaysApply: true` means the agent sees those rules on every turn — useful for things like "never push to main" and "update the devlog before you finish."

## Monorepo

A "monorepo" is one Git repository holding several related projects instead of splitting each into its own repo. Wave's monorepo has two "apps" (the mobile app and the admin website — things people actually open) and three "packages" (the API server, the database layer, and shared code — things the apps depend on but never see directly). npm workspaces is the tool that lets all five projects share one `node_modules` install and reference each other by name (e.g. the API imports `@wave/db` the same way it would import any library from the internet).

## Prisma and "the schema is the database"

Prisma is a tool that lets you describe your database tables in a single readable file (`schema.prisma`) instead of writing raw SQL by hand. You write "a `Product` has a `name`, a `price`, and a `status`," and Prisma generates fully type-checked code to read and write that table — so if you typo a field name, the error shows up while writing the code, not when a real order fails in production. Today's schema was built to match the tables the technical document already specified, so the database and the documentation now agree exactly.

## Why we write tests for money math

The "discount engine" is the small piece of code that decides how much a delivery actually costs — base fee, minus a loyalty discount after 6 deliveries, plus a surcharge for non-standard days. Getting this wrong means either the business loses money or a student gets overcharged. We wrote automated tests that check known scenarios ("a student with exactly 6 deliveries gets 20% off," "a Monday order costs 30% more") and ran them — all 11 passed on the first real run. Tests like this matter more for money-handling code than almost anywhere else in the app, because a silent rounding bug could run for months before anyone notices.

## Type-checking as a safety net

TypeScript is JavaScript with an extra layer that checks your code's shapes are consistent — e.g., "this function expects a number, you're passing a string" — before the code ever runs. Every piece of Wave (mobile, admin, API, database layer) was checked this way today and came back clean, meaning the pieces fit together correctly even though none of them has touched a real server yet. It's a bit like proofreading a contract for internal contradictions before anyone signs it — it doesn't guarantee the contract makes sense in the real world, but it catches an entire category of embarrassing mistakes for free.

## A day-one dependency bug

One library used for styling the mobile app (NativeWind) is supposed to teach React Native's built-in components a new attribute called `className`, the same way web developers style HTML elements. The documented way to enable this didn't actually work in this project's exact combination of tool versions — the fix was to write the same instruction a slightly different way. This is a common shape of bug in fast-moving JavaScript tooling: the official instructions are usually right, but "usually" isn't "always," so it's worth trying the direct version of a fix when the recommended shortcut silently doesn't work.
