# Moving production to DigitalOcean

Production runs as three DigitalOcean App Platform apps in Frankfurt (`fra`),
next to Neon. The database stays on Neon and auth/storage stay on Supabase;
only the hosting moves.

| App | Spec | What it is | Plan |
|---|---|---|---|
| `wave-api` | [`.do/api.yaml`](../.do/api.yaml) | Fastify API + pre-deploy migration job | Always-on, 512 MB |
| `wave-admin` | [`.do/admin.yaml`](../.do/admin.yaml) | Next.js admin + `/legal/*` | Always-on, 512 MB |
| `wave-web` | [`.do/web.yaml`](../.do/web.yaml) | Student web app / PWA | Static site (free allowance) |

Staging stays on Render's free plan (`render.yaml`). App Platform has no free
always-on service, so a DigitalOcean staging API would be another paid instance
for something that takes no real money.

Check current prices at digitalocean.com/pricing/app-platform before creating
anything. At the time of writing the 512 MB instance was about $5/month, so
the API and admin together come to roughly $10. Static sites fall in the free
allowance up to a small number per account.

---

## 1. One-time setup

1. Create a DigitalOcean account and add a payment method.
2. Install and sign in to the CLI:
   ```
   brew install doctl
   doctl auth init        # paste a personal access token (API → Tokens, read + write)
   ```
3. Give App Platform access to the repo: DigitalOcean dashboard → **Apps → Create
   App → GitHub → Manage access** → allow the `This-Wave` org, `wave-v2` repo.
   `doctl apps create` fails with a repo-access error until this is done.
4. Open the Render dashboard and copy every environment variable from `wave-api`
   and `wave-admin` into a password manager. Copy them, don't regenerate them:
   - **`JWT_SECRET` must be the same value.** It encrypts delivery PINs that are
     already stored; a new value makes those undecryptable (the bcrypt check at
     the door still works, but owners can no longer see their PIN in-app).
   - `DATABASE_URL` is the Neon **pooled** string. `DIRECT_URL` is the same
     branch's **direct** string (Neon → Connection details → untick "Pooled").
     Migrations fail through the pooler.

If you have a domain, decide the hostnames now (for example `api.wave.app`,
`admin.wave.app`, `app.wave.app`). Adding custom domains before the cutover
means Paystack, Supabase and the apps get their final URLs once rather than
twice.

## 2. Create the apps

Order matters: each app needs the URL of the one before it.

```
doctl apps create --spec .do/api.yaml
doctl apps list                      # note the API's default ingress URL
```

1. **wave-api** → Settings → App-Level Environment Variables: fill `DATABASE_URL`,
   `DIRECT_URL`. Then the `api` component's variables: every `SECRET`, plus
   replace the `CHANGE-ME` in `APP_URL` with the URL from `doctl apps list`
   (with `https://`). Tick **Encrypt** on secrets. Save; it redeploys.
2. Check it:
   ```
   curl -s https://<api-url>/health      # → {"status":"ok","db":"ok"}
   ```
3. Create the other two, then fill their secrets and URLs the same way. Both
   take `https://<api-url>/v1`:
   ```
   doctl apps create --spec .do/admin.yaml
   doctl apps create --spec .do/web.yaml
   ```
   Their `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` values are baked in at build time.
   After editing them use **Actions → Force rebuild and deploy**; a restart keeps
   the old values.
4. Back on **wave-api**, set `CORS_ORIGINS` to the admin and web URLs
   (comma-separated, add `http://localhost:8081` for local dev). Without it the
   browser blocks every admin and web request.
5. Set `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL` on wave-web to its own
   URL + `/legal/terms.html` and `/legal/privacy.html`, then force rebuild.

If `doctl apps create` rejects the empty `SECRET` entries, create the app from
the dashboard instead (Apps → Create App → pick the repo), then open **Settings →
App Spec → Edit**, paste the file, and fill the values there.

## 3. Check before switching anything

- [ ] `/health` returns `ok` with `db: ok`.
- [ ] Admin: sign in, dashboard loads, `/legal/terms` opens.
- [ ] Web: loads, sign-in code arrives by SMS, a shop menu opens.
- [ ] Browser console on admin and web shows no CORS errors.
- [ ] After installing the PWA, the manifest loads (DevTools → Application →
      Manifest). App Platform static sites don't take custom headers the way
      `vercel.json` set them, so check this once.

Until step 4, Paystack and Supabase still call Render, so orders and sign-in
codes go through the old API. Both APIs can run at once: the abandoned-checkout
sweep is safe to run twice.

## 4. Cut over

Do these together, at a quiet time:

1. **Paystack** → Settings → API Keys & Webhooks → Webhook URL →
   `https://<api-url>/v1/payments/webhook`. Only one URL per key set, so this is
   the switch.
2. **Supabase** → Authentication → Hooks → Send SMS hook → URL →
   `https://<api-url>/v1/auth/sms-hook`. The hook secret is unchanged.
3. **Native app builds**: set `EXPO_PUBLIC_API_URL` to `https://<api-url>/v1` in
   the EAS environment (expo.dev → project → Environment variables) and ship a
   new build or OTA update. Installed apps keep calling Render until they update,
   so keep Render's API running until they have.
4. **Uptime check**: GitHub → repo Settings → Variables → set `API_HEALTH_URL`
   (`https://<api-url>/health`) and `WEB_URL` (the web app's URL).
5. Place one real order end to end and watch it move to Paid without the app
   open (close it after paying). That proves the webhook reaches the new API.

**Rollback:** point the Paystack webhook and the Supabase SMS hook back at the
Render URL. Nothing else needs undoing.

## 5. Shut down the old hosting

Once no traffic reaches Render's production API (its logs go quiet):

1. Render: delete `wave-api` and `wave-admin`. Keep the two staging services.
2. Remove the production blocks from `render.yaml`, so a blueprint sync can't
   recreate them.
3. Vercel: delete the student web project, and `apps/mobile/vercel.json`.

## Day to day

- Merging to `main` deploys all three apps. Migrations run in the API's
  pre-deploy job; if one fails, the deploy stops and the previous version keeps
  serving.
- Logs: `doctl apps logs <app-id> api --type run --follow`.
- The API spec has alerts for memory above 85% and repeated restarts. If memory
  alerts keep firing, move the `api` component to the 1 GB size.
- To change an app's config after it exists, edit the **live** spec, not the
  file in the repo: `doctl apps spec get <app-id> > live.yaml`, edit, then
  `doctl apps update <app-id> --spec live.yaml`. The live spec carries the
  encrypted secret values (`EV[...]`); updating from the repo file, which has
  none, can wipe them. Copy the change back into `.do/` so the repo stays the
  record, and don't commit `live.yaml`.
