import { describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../../../test/harness";
import { orderRoutes } from "../routes";
import { paymentRoutes } from "../../payments/routes";
import {
  ORDER_CREATE_RATE_LIMIT,
  PAYMENT_INITIATE_RATE_LIMIT,
} from "../../../plugins/rateLimit";

/**
 * These assert the limiter engages and — more importantly — that it counts per
 * account rather than per IP.
 *
 * The IP question is the one that matters at Ashesi. The whole campus reaches
 * the internet through a small number of addresses, so an IP-keyed limit on a
 * student route would let one person exhaust the quota for everyone in their
 * hall on a Wave day. `@fastify/rate-limit` keys on IP by default, which is why
 * every one of these routes overrides `keyGenerator`.
 *
 * Each request sends a deliberately invalid body. The handler rejects it with
 * 400 without touching Prisma, so a 400 means "the limiter let this through"
 * and a 429 means "the limiter stopped it" — which isolates the limiter from
 * everything downstream of it.
 */

/** A user object the test mutates between requests to change identity. */
function mutableUser(id: string, role: "student" | "rider") {
  return { id, role } as { id: string; role: "student" | "rider" };
}

async function post(app: FastifyInstance, url: string) {
  return app.inject({ method: "POST", url, payload: { deliberately: "invalid" } });
}

describe("order creation is rate limited per account", () => {
  test(`allows ${ORDER_CREATE_RATE_LIMIT.max}, then answers 429`, async () => {
    const user = mutableUser("student-1", "student");
    const app = await buildTestApp(orderRoutes, { prisma: {}, user, rateLimit: true });

    for (let i = 0; i < ORDER_CREATE_RATE_LIMIT.max; i++) {
      const res = await post(app, "/");
      expect(res.statusCode, `request ${i + 1} should reach the handler`).not.toBe(429);
    }
    expect((await post(app, "/")).statusCode).toBe(429);
    await app.close();
  });

  test("a second student is unaffected by the first exhausting the limit", async () => {
    // The campus-NAT regression. Same app, same client address, different
    // account — if this ever returns 429, the limit has silently become
    // per-IP and one student can lock out their whole hall.
    const user = mutableUser("student-1", "student");
    const app = await buildTestApp(orderRoutes, { prisma: {}, user, rateLimit: true });

    for (let i = 0; i <= ORDER_CREATE_RATE_LIMIT.max; i++) await post(app, "/");
    expect((await post(app, "/")).statusCode).toBe(429);

    user.id = "student-2";
    expect((await post(app, "/")).statusCode).not.toBe(429);
    await app.close();
  });
});

describe("opening a checkout is rate limited per account", () => {
  test(`allows ${PAYMENT_INITIATE_RATE_LIMIT.max}, then answers 429`, async () => {
    // Every call creates a real transaction at Paystack, so an uncapped caller
    // is a free way to fill Paystack with noise and pile work onto the sweep.
    const user = mutableUser("student-1", "student");
    const app = await buildTestApp(paymentRoutes, { prisma: {}, user, rateLimit: true });

    for (let i = 0; i < PAYMENT_INITIATE_RATE_LIMIT.max; i++) {
      const res = await post(app, "/initiate");
      expect(res.statusCode, `request ${i + 1} should reach the handler`).not.toBe(429);
    }
    expect((await post(app, "/initiate")).statusCode).toBe(429);
    await app.close();
  });

  test("the two checkout routes hold separate budgets", async () => {
    // A dual-payment `shop_pickup` order legitimately opens both, and
    // exhausting one must not close the other.
    const user = mutableUser("student-1", "student");
    const app = await buildTestApp(paymentRoutes, { prisma: {}, user, rateLimit: true });

    for (let i = 0; i <= PAYMENT_INITIATE_RATE_LIMIT.max; i++) await post(app, "/initiate");
    expect((await post(app, "/initiate")).statusCode).toBe(429);
    expect((await post(app, "/initiate-goods")).statusCode).not.toBe(429);
    await app.close();
  });
});

describe("the limiter tells the caller how to behave", () => {
  test("a 429 carries retry-after and the limit headers", async () => {
    const user = mutableUser("student-1", "student");
    const app = await buildTestApp(orderRoutes, { prisma: {}, user, rateLimit: true });

    for (let i = 0; i <= ORDER_CREATE_RATE_LIMIT.max; i++) await post(app, "/");
    const res = await post(app, "/");

    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    await app.close();
  });
});
