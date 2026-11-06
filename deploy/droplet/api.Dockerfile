# Wave API. Also runs migrations: the compose `migrate` service uses this image.
# Build from the repo root: docker build -f deploy/droplet/api.Dockerfile .
FROM node:22-bookworm-slim AS base
# Prisma's engines need OpenSSL at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS tools
# bcrypt falls back to compiling from source when no prebuilt binary matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/api/package.json packages/api/

FROM tools AS build
# Only these three workspaces: the mobile app's dependencies are over a gigabyte.
RUN npm ci --include=dev \
  --workspace packages/shared --workspace packages/db --workspace packages/api \
  --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY packages/api packages/api
RUN npm run build --workspace packages/api \
  && node -p "require('prisma/package.json').version" > /prisma-version

# Runtime dependencies only: no TypeScript, test runner or Prisma CLI.
FROM tools AS deps
RUN npm ci --omit=dev \
  --workspace packages/shared --workspace packages/db --workspace packages/api \
  --include-workspace-root \
  && npm cache clean --force

FROM base
ENV NODE_ENV=production CHECKPOINT_DISABLE=1
# The Prisma CLI is a dev dependency, but the migrate service needs it. Same
# version as the lockfile, so migrations run with the engine they were made for.
COPY --from=build /prisma-version /tmp/prisma-version
RUN npm install -g "prisma@$(cat /tmp/prisma-version)" \
  && npm cache clean --force && rm /tmp/prisma-version
COPY --from=deps /app ./
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/packages/db/prisma packages/db/prisma
COPY --from=build /app/packages/api/dist packages/api/dist
USER node
EXPOSE 4000
CMD ["node", "packages/api/dist/index.js"]
