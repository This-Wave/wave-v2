# Student web app (PWA) baked into the Caddy image that fronts everything.
# Caddy serves these files itself and proxies the API and admin hosts; its
# Caddyfile is mounted from the droplet so new sites need no rebuild.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --include=dev \
  --workspace packages/shared --workspace apps/mobile \
  --include-workspace-root
COPY packages/shared packages/shared
COPY apps/mobile apps/mobile
# EXPO_PUBLIC_* are inlined at build time.
ARG EXPO_PUBLIC_API_URL
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ARG EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY
ARG EXPO_PUBLIC_TERMS_URL
ARG EXPO_PUBLIC_PRIVACY_URL
ARG EXPO_PUBLIC_SENTRY_DSN
ARG EXPO_PUBLIC_SUPPORT_EMAIL
ARG EXPO_PUBLIC_SUPPORT_WHATSAPP
# The legal-page script loads @wave/shared, so it builds first.
RUN npm run build --workspace @wave/shared && npm run build:web --workspace apps/mobile

FROM caddy:2-alpine
COPY --from=build /app/apps/mobile/dist /srv/web
