# Neon — Backup & Restore Runbook

**Checklist item:** M2  
**Last updated:** 2026-08-18  
**Database:** Neon PostgreSQL 16 (Wave production data)

Use this when you need to recover from a bad migration, accidental data loss, or before a risky schema change.

---

## What Neon gives you

Neon includes **point-in-time recovery (PITR)** on paid plans and branch-based restores on all tiers. A **branch** is a copy-on-write fork of your database at a moment in time — ideal for staging or rehearsing a restore without touching production.

---

## Before you need a restore

1. Confirm PITR / branch retention in the [Neon console](https://console.neon.tech) for your project.
2. Note your production connection string location (Render `DATABASE_URL` on **wave-api**).
3. Never paste production URLs into local `.env` files that get committed.

---

## Restore to a new branch (safe rehearsal)

1. Neon console → **Branches** → **Create branch**.
2. Source: `main` (production branch) at **current time** or a timestamp before the incident.
3. Copy the new branch’s connection string.
4. Point a **staging** API (or local `packages/api/.env`) at the branch URL.
5. Run smoke checks: `/health`, login, read-only admin queries.
6. If good, decide whether to promote the branch or migrate data selectively.

---

## Point-in-time restore (production cutover)

Only when the production branch itself must be rewound:

1. Neon console → **Restore** (or create branch from timestamp, then swap).
2. Update Render **wave-api** `DATABASE_URL` to the restored connection string.
3. Trigger a **manual redeploy** of wave-api (migrations run on build — ensure they match the restored schema era).
4. Verify `/health` → `{ "db": "ok" }`.
5. Run a subset of [`pilot-e2e-walkthrough.md`](./pilot-e2e-walkthrough.md) on **test** Paystack.

---

## After a restore

| Check | Expected |
|-------|----------|
| `/health` | `200`, `db: "ok"` |
| Admin login | Loads dashboard stats |
| Latest migration | Matches code on deployed commit |
| Paystack webhooks | Still reach live API URL (cold-start plan upgraded per C11) |

Document the incident: what broke, restore timestamp chosen, and whether any orders need manual Paystack reconciliation.

---

## What this does **not** replace

- **Supabase Auth** users are separate from Neon — restoring Neon does not roll back auth users.
- **Paystack** charges are external — DB restore does not refund or replay webhooks automatically.
- **Object storage** (shop images in Supabase Storage) is not in Neon.

---

## Emergency contacts

Keep off-repo: Neon project owner login, Render account owner, Paystack dashboard access.
