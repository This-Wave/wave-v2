# Moving production to a DigitalOcean droplet

Production runs on one DigitalOcean droplet (a virtual server) in Frankfurt
(`fra1`), next to Neon, with each part of Wave in its own Docker container. The
database stays on Neon and auth/storage stay on Supabase; only the hosting
moves.

| Container | Image built from | What it does |
|---|---|---|
| `web` | [`deploy/droplet/web.Dockerfile`](../deploy/droplet/web.Dockerfile) | Caddy: HTTPS for every hostname, serves the student web app, forwards the other hosts |
| `api` | [`deploy/droplet/api.Dockerfile`](../deploy/droplet/api.Dockerfile) | Fastify API |
| `migrate` | same image as `api` | Runs `prisma migrate deploy`, then exits. The API only starts if it succeeds |
| `admin` | [`deploy/droplet/admin.Dockerfile`](../deploy/droplet/admin.Dockerfile) | Next.js admin dashboard |

GitHub Actions builds the images on every push to `main`
([`.github/workflows/deploy-droplet.yml`](../.github/workflows/deploy-droplet.yml)),
stores them in GitHub's container registry (GHCR), then SSHes into the droplet
and runs [`deploy.sh`](../deploy/droplet/deploy.sh). The droplet never builds
anything, so a small one is enough.

**Size and cost.** `s-1vcpu-2gb` (about $12/month, plus 20% for backups) leaves
room for a second app. Wave alone fits in `s-1vcpu-1gb` (about $6). Check
digitalocean.com/pricing before creating it. Staging stays on Render's free
plan (`render.yaml`).

**You look after the server.** Security updates install themselves, but a
reboot after a kernel update, disk space and Docker upgrades are yours. Weekly
backups are switched on below.

---

## 1. Before you start

1. Open the Render dashboard and copy every environment variable from
   `wave-api` into a password manager. Copy them, don't regenerate them:
   - **`JWT_SECRET` must be the same value.** It encrypts delivery PINs that are
     already stored; a new value makes those undecryptable (the bcrypt check at
     the door still works, but owners can no longer see their PIN in-app).
   - `DATABASE_URL` is the Neon **pooled** string. `DIRECT_URL` is the same
     branch's **direct** string (Neon → Connection details → untick "Pooled").
     Migrations fail through the pooler.
2. Pick three hostnames, for example `api.wave.app`, `admin.wave.app` and
   `app.wave.app`. No domain yet? Use `api.<ip>.sslip.io`, `admin.<ip>.sslip.io`
   and `app.<ip>.sslip.io` once you know the droplet's IP: sslip.io resolves
   those to the IP for free, and Caddy still gets real certificates. Moving to a
   real domain later means repeating the hostname steps below.
3. Sign in to the CLI (`brew install doctl`, then `doctl auth init`).
4. If DigitalOcean doesn't have your SSH key yet:
   ```
   doctl compute ssh-key import my-laptop --public-key-file ~/.ssh/id_ed25519.pub
   doctl compute ssh-key list          # note the ID
   ```

## 2. Create the droplet

From the repo root:

```
doctl compute droplet create wave-prod \
  --region fra1 --size s-1vcpu-2gb --image ubuntu-24-04-x64 \
  --ssh-keys <ssh-key-id> \
  --user-data-file deploy/droplet/cloud-init.yaml \
  --enable-backups --enable-monitoring --wait
doctl compute droplet list --format Name,PublicIPv4
```

[`cloud-init.yaml`](../deploy/droplet/cloud-init.yaml) installs Docker, opens
only SSH, 80 and 443 in the firewall, turns off password logins, adds 2 GB of
swap, and creates a `deploy` user with your SSH key. It takes a few minutes
after the droplet is up; it's done when this prints a version:

```
ssh deploy@<ip> docker --version
```

Optional: **Networking → Reserved IPs** gives the droplet an address that
survives rebuilding it. Use that IP in DNS if you take it.

## 3. DNS

Add an **A record** for each hostname pointing at the droplet's IP (skip this
for sslip.io). Caddy asks Let's Encrypt for certificates on first start, and
that fails until the records resolve: `dig +short api.wave.app` should print the
IP.

## 4. The server's `.env`

```
scp deploy/droplet/env.example deploy@<ip>:/opt/wave/.env
ssh deploy@<ip>
chmod 600 /opt/wave/.env
nano /opt/wave/.env
```

Fill it from step 1. `APP_URL` is `https://` + the API hostname, and
`CORS_ORIGINS` lists the admin and web origins. The secrets live only in this
file; nothing in the repo or GitHub holds them.

## 5. Connect GitHub

1. Make a key that GitHub Actions uses to log in to the droplet, and allow it:
   ```
   ssh-keygen -t ed25519 -N "" -C github-deploy -f wave-deploy
   ssh deploy@<ip> 'cat >> ~/.ssh/authorized_keys' < wave-deploy.pub
   ssh-keyscan <ip> > wave-known-hosts
   ```
2. Repo **Settings → Secrets and variables → Actions → Secrets**:
   - `DROPLET_HOST`: the IP
   - `DROPLET_SSH_KEY`: the contents of `wave-deploy` (the private key)
   - `DROPLET_KNOWN_HOSTS`: the contents of `wave-known-hosts`

   Then delete `wave-deploy` from your laptop.
3. Same page, **Variables** tab. These are baked into the admin and web images
   at build time, so changing one needs a new deploy. Both API URLs end in `/v1`.

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_API_URL` | `https://<api-host>/v1` |
   | `NEXT_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack public key (`pk_`) |
   | `EXPO_PUBLIC_TERMS_URL` | `https://<web-host>/legal/terms.html` |
   | `EXPO_PUBLIC_PRIVACY_URL` | `https://<web-host>/legal/privacy.html` |
   | `NEXT_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_DSN` | optional |
   | `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_SUPPORT_WHATSAPP` | optional |

   The anon and `pk_` keys are public by design; the secret keys stay in the
   droplet's `.env`.

## 6. First deploy

Actions → **Deploy (DigitalOcean droplet)** → Run workflow (from `main`). It
builds the three images, copies the compose file, Caddyfile and `deploy.sh` to
`/opt/wave`, runs migrations, starts everything and checks `/health`. After that,
every merge to `main` deploys by itself.

If it fails, look on the server:

```
ssh deploy@<ip>
cd /opt/wave
docker compose ps
docker compose logs migrate api --tail 100
docker compose logs web --tail 50      # certificate problems show here
```

## 7. Check before switching anything

- [ ] `curl -s https://<api-host>/health` returns `ok` with `db: ok`.
- [ ] Admin: sign in, dashboard loads.
- [ ] Web: loads, sign-in code arrives by SMS, a shop menu opens.
- [ ] Browser console on admin and web shows no CORS errors.
- [ ] Web: DevTools → Application → Manifest loads, and the service worker
      registers.

Until step 8, Paystack and Supabase still call Render, so orders and sign-in
codes go through the old API. Both APIs can run at once: the abandoned-checkout
sweep is safe to run twice.

## 8. Cut over

Do these together, at a quiet time:

1. **Paystack** → Settings → API Keys & Webhooks → Webhook URL →
   `https://<api-host>/v1/payments/webhook`. Only one URL per key set, so this is
   the switch.
2. **Supabase** → Authentication → Hooks → Send SMS hook → URL →
   `https://<api-host>/v1/auth/sms-hook`. The hook secret is unchanged.
3. **Native app builds**: set `EXPO_PUBLIC_API_URL` to `https://<api-host>/v1` in
   the EAS environment (expo.dev → project → Environment variables) and ship a
   new build or OTA update. Installed apps keep calling Render until they update,
   so keep Render's API running until they have.
4. **Uptime check**: repo Settings → Variables → set `API_HEALTH_URL`
   (`https://<api-host>/health`) and `WEB_URL` (`https://<web-host>`).
5. Place one real order end to end and watch it move to Paid without the app
   open (close it after paying). That proves the webhook reaches the new API.

**Rollback:** point the Paystack webhook and the Supabase SMS hook back at the
Render URL. Nothing else needs undoing.

## 9. Shut down the old hosting

Once no traffic reaches Render's production API (its logs go quiet):

1. Render: delete `wave-api` and `wave-admin`. Keep the two staging services.
2. Remove the production blocks from `render.yaml`, so a blueprint sync can't
   recreate them.
3. Vercel: delete the student web project, and `apps/mobile/vercel.json`.

---

## Day to day

- **Deploys:** merge to `main`. A failed migration stops the deploy and the
  running API stays up.
- **Roll back code:** Actions → Deploy → Run workflow → `tag` = an earlier `main`
  commit SHA. Nothing is rebuilt. Migrations don't roll back, so a rollback past
  a migration only works if the older code tolerates the newer schema.
- **Change a secret:** edit `/opt/wave/.env`, then `./deploy.sh` in `/opt/wave`
  (no tag: it reuses the current one).
- **Logs:** `docker compose logs -f api` in `/opt/wave`. They rotate at 30 MB
  per container.
- **Reboots:** after a kernel update the login banner says a restart is
  required. `sudo reboot` at a quiet time; the containers come back on their own.
- **Disk:** `df -h /` and `docker system df`. `deploy.sh` clears images older
  than a week.
- **Manual pulls:** the registry login on the droplet expires when the workflow
  ends, so `docker compose pull` by hand fails. Deploy through the workflow, or
  `docker login ghcr.io` with a personal token that has `read:packages`.

## Hosting another app on the same droplet

1. Add a service to `deploy/droplet/docker-compose.yml`, with no `ports:`.
   Caddy reaches it by service name.
2. Add a site block to `deploy/droplet/Caddyfile`, e.g.
   `{$SHOP_HOST} { reverse_proxy shop:8080 }`, and pass `SHOP_HOST` to the
   `web` service's `environment`.
3. Add `SHOP_HOST=...` (and the app's own secrets) to `/opt/wave/.env`, and a DNS
   record pointing at the droplet.
4. Deploy. Caddy gets the new certificate itself.

Never publish a port on an app container (`ports: - "8080:8080"`). Docker
writes its own firewall rules, so a published port is open to the internet even
though ufw doesn't list it.

If the second app has its own repo, give it its own compose project under
`/opt/<app>` instead, and join it to Caddy's network: in its compose file, add
`networks: [wave_default]` to the service and declare `wave_default` as
`external: true`.
