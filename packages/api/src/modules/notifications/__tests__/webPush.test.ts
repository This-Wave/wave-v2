import { beforeEach, describe, expect, test, vi } from "vitest";
import webpush from "web-push";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Role } from "../../../plugins/auth";

const sendExpoPush = vi.fn();
vi.mock("../expo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../expo")>()),
  sendExpoPush: (...args: unknown[]) => sendExpoPush(...args),
}));

import { notificationRoutes } from "../routes";
import { notifyLoyaltyProgress } from "../dispatch";
import { sweepRiderWaiting } from "../reminders";
import { buildTestApp } from "../../../test/harness";

const student = { id: "student-1", role: "student" as Role };
const vapid = webpush.generateVAPIDKeys();
const VAPID_ENV = { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: "mailto:ops@example.com" };
const SUBSCRIPTION = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p256", auth: "auth" } };
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger;

beforeEach(() => {
  vi.clearAllMocks();
  sendExpoPush.mockImplementation(async (messages: unknown[]) => messages.map(() => ({ status: "ok" })));
});

function subscriptionPrisma() {
  return { webPushSubscription: { upsert: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) } };
}

describe("web push routes", () => {
  test("the key is null while web push is not configured, so the app offers nothing", async () => {
    const app = await buildTestApp(notificationRoutes, { prisma: subscriptionPrisma(), user: student });
    expect((await app.inject({ method: "GET", url: "/web-push/key" })).json()).toEqual({ publicKey: null });
  });

  test("the key is served once configured", async () => {
    const app = await buildTestApp(notificationRoutes, { prisma: subscriptionPrisma(), user: student, env: VAPID_ENV });
    expect((await app.inject({ method: "GET", url: "/web-push/key" })).json()).toEqual({ publicKey: vapid.publicKey });
  });

  test("subscribing attaches the browser to whoever is signed in, moving it off anyone else", async () => {
    const prisma = subscriptionPrisma();
    const app = await buildTestApp(notificationRoutes, { prisma, user: student, env: VAPID_ENV });
    const res = await app.inject({ method: "POST", url: "/web-push", payload: SUBSCRIPTION });
    expect(res.statusCode).toBe(200);
    expect(prisma.webPushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: SUBSCRIPTION.endpoint },
        update: expect.objectContaining({ profileId: "student-1" }),
      }),
    );
  });

  test("an endpoint that isn't https is refused: the server would post to it", async () => {
    const prisma = subscriptionPrisma();
    const app = await buildTestApp(notificationRoutes, { prisma, user: student, env: VAPID_ENV });
    const res = await app.inject({
      method: "POST",
      url: "/web-push",
      payload: { ...SUBSCRIPTION, endpoint: "http://169.254.169.254/latest" },
    });
    expect(res.statusCode).toBe(400);
    expect(prisma.webPushSubscription.upsert).not.toHaveBeenCalled();
  });

  test("unsubscribing only removes the caller's own subscription", async () => {
    const prisma = subscriptionPrisma();
    const app = await buildTestApp(notificationRoutes, { prisma, user: student, env: VAPID_ENV });
    await app.inject({ method: "DELETE", url: "/web-push", payload: { endpoint: SUBSCRIPTION.endpoint } });
    expect(prisma.webPushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: SUBSCRIPTION.endpoint, profileId: "student-1" },
    });
  });
});

function fakeFastify(prisma: Record<string, unknown>): FastifyInstance {
  return { prisma, config: {} } as unknown as FastifyInstance;
}

function loyaltyPrisma() {
  return {
    platformConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    profile: { findMany: vi.fn().mockResolvedValue([{ id: "student-1", pushToken: "ExponentPushToken[abc]" }]) },
  };
}

function sentTitles(): string[] {
  return sendExpoPush.mock.calls.flatMap(([messages]) => (messages as { title: string }[]).map((m) => m.title));
}

describe("loyalty notifications", () => {
  test("one delivery short of the card says so", async () => {
    await notifyLoyaltyProgress({ fastify: fakeFastify(loyaltyPrisma()), log, studentId: "student-1", stamps: 5 });
    expect(sentTitles()).toEqual(["One more delivery"]);
  });

  test("a full card announces the discount", async () => {
    await notifyLoyaltyProgress({ fastify: fakeFastify(loyaltyPrisma()), log, studentId: "student-1", stamps: 6 });
    expect(sentTitles()).toEqual(["20% off your next delivery"]);
  });

  test("every other delivery is quiet", async () => {
    for (const stamps of [1, 3, 7]) {
      await notifyLoyaltyProgress({ fastify: fakeFastify(loyaltyPrisma()), log, studentId: "student-1", stamps });
    }
    expect(sendExpoPush).not.toHaveBeenCalled();
  });
});

describe("rider waiting", () => {
  function waitingPrisma(claimed: boolean) {
    return {
      order: {
        findMany: vi.fn().mockResolvedValue([
          { id: "order-1", studentId: "student-1", checkpoint: { name: "Hostel Block A" }, rider: { fullName: "Kofi" } },
        ]),
      },
      reminderLog: { create: claimed ? vi.fn().mockResolvedValue({}) : vi.fn().mockRejectedValue(new Error("unique")) },
      profile: { findMany: vi.fn().mockResolvedValue([{ id: "student-1", pushToken: "ExponentPushToken[abc]" }]) },
    };
  }

  test("chases the student once the rider has waited, naming who and where", async () => {
    const prisma = waitingPrisma(true);
    const { sent } = await sweepRiderWaiting({ fastify: fakeFastify(prisma), log });
    expect(sent).toBe(1);
    expect(prisma.order.findMany.mock.calls[0]?.[0].where.status).toBe("at_checkpoint");
    const message = (sendExpoPush.mock.calls[0]?.[0] as { body: string }[])[0]!;
    expect(message.body).toContain("Kofi is still at Hostel Block A");
  });

  test("only once per order", async () => {
    const { sent } = await sweepRiderWaiting({ fastify: fakeFastify(waitingPrisma(false)), log });
    expect(sent).toBe(0);
    expect(sendExpoPush).not.toHaveBeenCalled();
  });
});
