# Wave API. Also runs migrations: the compose `migrate` service uses this image.
# Build from the repo root: docker build -f deploy/droplet/api.Dockerfile .
FROM node:22-bookworm-slim AS base
# Prisma's engines need OpenSSL at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
# bcrypt falls back to compiling from source when no prebuilt binary matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/api/package.json packages/api/
# Only these three workspaces: the mobile app's dependencies are over a gigabyte.
RUN npm ci --include=dev \
  --workspace packages/shared --workspace packages/db --workspace packages/api \
  --include-workspace-root
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY packages/api packages/api
RUN npm run build --workspace packages/api

FROM base
ENV NODE_ENV=production
COPY --from=build /app /app
USER node
EXPOSE 4000
CMD ["node", "packages/api/dist/index.js"]
