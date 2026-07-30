import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { notifyOrderStatus, pushToProfiles } from "../dispatch";
import { sendExpoPush } from "../expo";

vi.mock("../expo", async () => {
  const actual = await vi.importActual<typeof import("../expo")>("../expo");
  return { ...actual, sendExpoPush: vi.fn() };
});

const sendMock = vi.mocked(sendExpoPush);

interface FakeProfile {
  id: string;
  pushToken: string | null;
}

function harness(options: { profiles?: FakeProfile[]; order?: unknown } = {}) {
  // Honours `where.id.in` and `pushToken: { not: null }` the way Prisma would —
  // without that, a test asserting "the rider was not notified" would pass even
  // if the code asked for the wrong profiles.
  const findMany = vi.fn(async (args: { where: { id: { in: string[] } } }) =>
    (options.profiles ?? []).filter(
      (p) => p.pushToken !== null && args.where.id.in.includes(p.id),
    ),
  );
  const updateMany = vi.fn(async () => ({ count: 0 }));
  const orderFindUnique = vi.fn(async () => options.order ?? null);

  const fastify = {
    config: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sk" },
    prisma: {
      profile: { findMany, updateMany },
      order: { findUnique: orderFindUnique },
    },
  } as unknown as FastifyInstance;

  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as FastifyBaseLogger;

  return { fastify, log, findMany, updateMany, orderFindUnique };
}

/** The batch handed to Expo on the nth call. */
const batch = (call = 0) => sendMock.mock.calls[call]![0];
/** The first message of that batch — every assertion here sends one at a time. */
const only = (call = 0) => batch(call)[0]!;

const order = (overrides: Record<string, unknown> = {}) => ({
  id: "o1",
  studentId: "student-1",
  riderId: null,
  status: "confirmed",
  cancellationReason: null,
  shop: { name: "Kofi's Kitchen" },
  checkpoint: { name: "Main Gate" },
  rider: null,
  ...overrides,
});

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockImplementation(async (messages) => messages.map(() => ({ status: "ok" as const })));
});

describe("pushToProfiles", () => {
  test("sends one message per profile that has a valid token", async () => {
    const h = harness({
      profiles: [
        { id: "a", pushToken: "ExponentPushToken[aaa]" },
        { id: "b", pushToken: "ExpoPushToken[bbb]" },
      ],
    });

    const result = await pushToProfiles({
      fastify: h.fastify,
      log: h.log,
      profileIds: ["a", "b"],
      payload: { title: "T", body: "B" },
    });

    expect(result.sent).toBe(2);
    const messages = batch();
    expect(messages.map((m) => m.to)).toEqual(["ExponentPushToken[aaa]", "ExpoPushToken[bbb]"]);
  });

  test("skips tokens that are not Expo push tokens without calling the provider", async () => {
    const h = harness({ profiles: [{ id: "a", pushToken: "fcm-raw-token" }] });

    const result = await pushToProfiles({
      fastify: h.fastify,
      log: h.log,
      profileIds: ["a"],
      payload: { title: "T", body: "B" },
    });

    expect(result.sent).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("clears the stored token when Expo reports DeviceNotRegistered", async () => {
    const h = harness({
      profiles: [
        { id: "a", pushToken: "ExponentPushToken[aaa]" },
        { id: "b", pushToken: "ExponentPushToken[bbb]" },
      ],
    });
    sendMock.mockImplementation(async () => [
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "ok" },
    ]);

    await pushToProfiles({
      fastify: h.fastify,
      log: h.log,
      profileIds: ["a", "b"],
      payload: { title: "T", body: "B" },
    });

    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a"] } },
      data: { pushToken: null },
    });
  });

  test("swallows a provider failure — a push must never fail its caller", async () => {
    const h = harness({ profiles: [{ id: "a", pushToken: "ExponentPushToken[aaa]" }] });
    sendMock.mockImplementation(async () => {
      throw new Error("provider down");
    });

    await expect(
      pushToProfiles({
        fastify: h.fastify,
        log: h.log,
        profileIds: ["a"],
        payload: { title: "T", body: "B" },
      }),
    ).resolves.toEqual({ sent: 0 });
    expect(h.log.error).toHaveBeenCalled();
  });

  test("does nothing when no profile ids are given", async () => {
    const h = harness();
    const result = await pushToProfiles({
      fastify: h.fastify,
      log: h.log,
      profileIds: [],
      payload: { title: "T", body: "B" },
    });
    expect(result.sent).toBe(0);
    expect(h.findMany).not.toHaveBeenCalled();
  });
});

describe("notifyOrderStatus", () => {
  test("says nothing for a status with no student-facing meaning", async () => {
    const h = harness({ order: order() });
    await notifyOrderStatus({
      fastify: h.fastify,
      log: h.log,
      orderId: "o1",
      status: "payment_pending",
    });
    expect(h.orderFindUnique).not.toHaveBeenCalled();
  });

  test("never puts the delivery PIN in a push body", async () => {
    const h = harness({
      order: order(),
      profiles: [{ id: "student-1", pushToken: "ExponentPushToken[s]" }],
    });

    await notifyOrderStatus({ fastify: h.fastify, log: h.log, orderId: "o1", status: "confirmed" });

    const message = only();
    expect(message.body).not.toMatch(/\d{6}/);
    expect(message.body).toContain("SMS");
  });

  test("distinguishes refunded from cancelled — only one claims money moved", async () => {
    const cancelled = harness({
      order: order({ status: "cancelled", cancellationReason: "Shop closed" }),
      profiles: [{ id: "student-1", pushToken: "ExponentPushToken[s]" }],
    });
    await notifyOrderStatus({
      fastify: cancelled.fastify,
      log: cancelled.log,
      orderId: "o1",
      status: "cancelled",
    });
    expect(only().body).not.toMatch(/refund/i);

    sendMock.mockClear();

    const refunded = harness({
      order: order({ status: "refunded", cancellationReason: "Shop closed" }),
      profiles: [{ id: "student-1", pushToken: "ExponentPushToken[s]" }],
    });
    await notifyOrderStatus({
      fastify: refunded.fastify,
      log: refunded.log,
      orderId: "o1",
      status: "refunded",
    });
    expect(only().body).toMatch(/money is on its way back/i);
  });

  test("tells an assigned rider when the delivery is cancelled under them", async () => {
    const h = harness({
      order: order({ status: "cancelled", riderId: "rider-1", rider: { fullName: "Ama" } }),
      profiles: [
        { id: "student-1", pushToken: "ExponentPushToken[s]" },
        { id: "rider-1", pushToken: "ExponentPushToken[r]" },
      ],
    });

    await notifyOrderStatus({ fastify: h.fastify, log: h.log, orderId: "o1", status: "cancelled" });

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(only(1).title).toBe("Delivery cancelled");
  });

  test("does not notify a rider on a status that is only the student's business", async () => {
    const h = harness({
      order: order({ status: "delivered", riderId: "rider-1", rider: { fullName: "Ama" } }),
      profiles: [
        { id: "student-1", pushToken: "ExponentPushToken[s]" },
        { id: "rider-1", pushToken: "ExponentPushToken[r]" },
      ],
    });

    await notifyOrderStatus({ fastify: h.fastify, log: h.log, orderId: "o1", status: "delivered" });

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  test("swallows a database failure rather than failing the transition", async () => {
    const h = harness();
    (h.fastify.prisma.order.findUnique as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        throw new Error("neon unreachable");
      },
    );

    await expect(
      notifyOrderStatus({ fastify: h.fastify, log: h.log, orderId: "o1", status: "delivered" }),
    ).resolves.toBeUndefined();
    expect(h.log.error).toHaveBeenCalled();
  });
});
