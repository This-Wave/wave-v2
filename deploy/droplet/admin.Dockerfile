# Wave admin dashboard (Next.js). NEXT_PUBLIC_* are inlined at build time, so
# they are build args, and changing one means building a new image.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
RUN npm ci --include=dev \
  --workspace packages/shared --workspace apps/admin \
  --include-workspace-root
COPY packages/shared packages/shared
COPY apps/admin apps/admin
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_STANDALONE=1
RUN npm run build --workspace @wave/shared && npm run build --workspace apps/admin

# Standalone output: server.js plus only the node_modules files it imports.
FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# Docker sets HOSTNAME to the container ID, and the standalone server binds to it.
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/admin/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/admin/.next/static ./apps/admin/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
