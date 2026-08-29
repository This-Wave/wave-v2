# Wave staging environment

Use staging to exercise the full order → pay → deliver flow on **Paystack test keys** and a **Neon database branch**, without touching production data or live money.

## What gets deployed

| Service | Blueprint name | Git branch | Purpose |
|---------|----------------|------------|---------|
| API | `wave-api-staging` | `develop` | Fastify API + migrations |
| Admin | `wave-admin-staging` | `develop` | Next.js ops dashboard |

Production services (`wave-api`, `wave-admin`) stay on `main`. Staging blocks are defined in [`render.yaml`](../render.yaml).

## One-time setup

### 1. Neon branch

1. In [Neon console](https://console.neon.tech), open the Wave project.
2. **Branches → Create branch** from `main` (e.g. name it `staging`).
3. Copy the **pooled** connection string for that branch.
4. Paste it as `DATABASE_URL` on `wave-api-staging` in Render (never use prod’s URL here).

### 2. Render blueprint

1. Render → **Blueprints → New Blueprint Instance** → this repo (or sync an existing instance).
2. After first deploy, set `APP_URL` on staging API to its public URL (`https://…onrender.com`).
3. Set `CORS_ORIGINS` to include staging admin, student web preview, and local dev, e.g.  
   `https://wave-admin-staging.onrender.com,https://your-preview.vercel.app,http://localhost:8081`
4. Set `NEXT_PUBLIC_API_URL` on staging admin to the **staging API URL** (with `https://`), then **redeploy admin** — Next inlines public env at build time.

### 3. Paystack (test only)

- `PAYSTACK_SECRET_KEY` must be `sk_test_…` on staging.
- Use test cards / MoMo from the Paystack dashboard when walking through checkout.

### 4. Secrets that must differ from prod

- `DATABASE_URL` (Neon branch)
- `JWT_SECRET`
- Optionally `SMS_HOOK_SECRET`, `SENTRY_DSN`, Supabase keys if you use a separate project

You may reuse the same Supabase project as prod for auth/storage if you accept shared user accounts — for a cleaner split, use a second Supabase project.

### 5. Student app / web

Point local or preview builds at staging:

```env
EXPO_PUBLIC_API_URL=https://wave-api-staging.onrender.com
```

Rebuild web (`vercel` or `expo export`) after changing public env vars.

## Smoke check

1. `GET https://<staging-api>/health` → `{ "status": "ok", "db": "ok" }`
2. Admin login → dashboard loads
3. Register a test student → place order → Paystack test payment → verify order status updates

## Related docs

- End-to-end walkthrough: [`pilot-e2e-walkthrough.md`](./pilot-e2e-walkthrough.md) (run against staging URLs)
- Backup/restore: [`neon-backup-restore-runbook.md`](./neon-backup-restore-runbook.md)

## Notes

- Staging is on Render **free** tier by default (cold starts OK for QA).
- Migrations run on every staging deploy via `migrate:deploy` in the build command — same as prod.
- Do **not** put live Paystack keys on staging services.
