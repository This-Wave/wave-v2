import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rawBody from "fastify-raw-body";
import { loadEnv, type Env } from "./config/env";
import prismaPlugin from "./plugins/prisma";
import authPlugin from "./plugins/auth";
import { authRoutes } from "./modules/auth/routes";
import { profileRoutes } from "./modules/profiles/routes";
import { universityRoutes } from "./modules/checkpoints/routes";
import { shopRoutes } from "./modules/shops/routes";
import { productRoutes } from "./modules/products/routes";
import { orderRoutes } from "./modules/orders/routes";
import { paymentRoutes } from "./modules/payments/routes";
import { riderRoutes } from "./modules/riders/routes";
import { adminRoutes } from "./modules/admin/routes";

declare module "fastify" {
  interface FastifyInstance {
    config: Env;
  }
}

export function buildApp(): FastifyInstance {
  // Default 1MB body limit is too small for base64-encoded verification
  // photo uploads (see modules/riders/routes.ts POST /verification/upload).
  const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });
  const env = loadEnv();
  app.decorate("config", env);

  app.register(helmet);
  app.register(cors, { origin: true });
  app.register(sensible);
  // Opt-in per-route via { config: { rawBody: true } } — the Paystack
  // webhook needs the exact raw request bytes to verify its HMAC signature;
  // JSON.parse -> JSON.stringify round-tripping the body is not guaranteed
  // to reproduce the original bytes Paystack actually signed.
  app.register(rawBody, { field: "rawBody", global: false, runFirst: true });

  app.register(prismaPlugin);
  app.register(authPlugin);

  app.get("/health", async () => ({ status: "ok", env: env.NODE_ENV }));

  app.register(authRoutes, { prefix: "/v1/auth" });
  app.register(profileRoutes, { prefix: "/v1/profile" });
  app.register(universityRoutes, { prefix: "/v1" });
  app.register(shopRoutes, { prefix: "/v1/shops" });
  app.register(productRoutes, { prefix: "/v1" });
  app.register(orderRoutes, { prefix: "/v1/orders" });
  app.register(paymentRoutes, { prefix: "/v1/payments" });
  app.register(riderRoutes, { prefix: "/v1/riders" });
  app.register(adminRoutes, { prefix: "/v1/admin" });

  return app;
}
