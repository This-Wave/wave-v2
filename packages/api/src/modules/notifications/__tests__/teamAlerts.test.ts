import { describe, expect, test, vi, beforeEach } from "vitest";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";

const { sendEmailQuietly } = vi.hoisted(() => ({ sendEmailQuietly: vi.fn() }));
vi.mock("../../../lib/email", async (orig) => ({
  ...(await orig<typeof import("../../../lib/email")>()),
  sendEmailQuietly,
}));

import {
  announceFirstPaidOrder,
  announceSignup,
  firstOrderAlertText,
  signupAlertText,
} from "../teamAlerts";

const log = { warn: vi.fn() } as unknown as FastifyBaseLogger;

function makeFastify(opts: { watch?: boolean; paidOrders?: number; countThrows?: boolean } = {}) {
  const sendNow = vi.fn().mockResolvedValue(undefined);
  const fastify = {
    activityWatch: opts.watch === false ? null : { sendNow },
    config: { RESEND_API_KEY: "re_key", RESEND_FROM: "Wave <hi@example.com>" },
    prisma: {
      university: { findUnique: vi.fn().mockResolvedValue({ name: "Ashesi University" }) },
      profile: { findUnique: vi.fn().mockResolvedValue({ fullName: "Ama Mensah" }) },
      order: {
        count: opts.countThrows
          ? vi.fn().mockRejectedValue(new Error("db down"))
          : vi.fn().mockResolvedValue(opts.paidOrders ?? 1),
      },
    },
  } as unknown as FastifyInstance;
  return { fastify, sendNow };
}

const student = {
  fullName: "Ama Mensah",
  role: "student" as const,
  universityId: "uni-1",
  email: "ama@ashesi.edu.gh",
  isTest: false,
};

const order = {
  studentId: "stu-1",
  universityId: "uni-1",
  totalAmount: "50",
  isTest: false,
  shop: null,
};

beforeEach(() => {
  sendEmailQuietly.mockReset().mockResolvedValue({ sent: true });
});

describe("alert text", () => {
  test("sign-up shows name, role and campus", () => {
    expect(signupAlertText({ fullName: "Ama Mensah", role: "shop_owner", campus: "Ashesi University" })).toBe(
      "Ama Mensah · Shop owner · Ashesi University",
    );
  });

  test("first order names the shop, or Pickup when there is none", () => {
    expect(firstOrderAlertText({ fullName: "Ama", campus: "Ashesi", totalAmount: "50", shopName: null })).toBe(
      "Ama · Ashesi · Pickup · GH₵50.00",
    );
    expect(firstOrderAlertText({ fullName: "Ama", campus: "Ashesi", totalAmount: "62.5", shopName: "Kofi's" })).toBe(
      "Ama · Ashesi · Kofi's · GH₵62.50",
    );
  });
});

describe("announceSignup", () => {
  test("alerts Telegram and sends the welcome email", async () => {
    const { fastify, sendNow } = makeFastify();
    await announceSignup({ fastify, log, profile: student });
    expect(sendNow).toHaveBeenCalledWith("New sign-up", "Ama Mensah · Student · Ashesi University");
    expect(sendEmailQuietly).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ama@ashesi.edu.gh", subject: "Welcome to Wave, Ama", apiKey: "re_key" }),
    );
  });

  test("still emails when Telegram is not set up", async () => {
    const { fastify } = makeFastify({ watch: false });
    await announceSignup({ fastify, log, profile: student });
    expect(sendEmailQuietly).toHaveBeenCalledOnce();
  });

  test("test accounts do not alert", async () => {
    const { fastify, sendNow } = makeFastify();
    await announceSignup({ fastify, log, profile: { ...student, isTest: true } });
    expect(sendNow).not.toHaveBeenCalled();
  });

  test("never throws", async () => {
    const { fastify, sendNow } = makeFastify();
    sendNow.mockRejectedValue(new Error("telegram down"));
    await expect(announceSignup({ fastify, log, profile: student })).resolves.toBeUndefined();
  });
});

describe("announceFirstPaidOrder", () => {
  test("alerts on the first paid order", async () => {
    const { fastify, sendNow } = makeFastify({ paidOrders: 1 });
    await announceFirstPaidOrder({ fastify, log, order });
    expect(sendNow).toHaveBeenCalledWith("First order", "Ama Mensah · Ashesi University · Pickup · GH₵50.00");
  });

  test("stays quiet from the second paid order on", async () => {
    const { fastify, sendNow } = makeFastify({ paidOrders: 2 });
    await announceFirstPaidOrder({ fastify, log, order });
    expect(sendNow).not.toHaveBeenCalled();
  });

  test("skips test orders and does nothing without Telegram", async () => {
    const a = makeFastify();
    await announceFirstPaidOrder({ fastify: a.fastify, log, order: { ...order, isTest: true } });
    expect(a.sendNow).not.toHaveBeenCalled();
    const b = makeFastify({ watch: false });
    await expect(announceFirstPaidOrder({ fastify: b.fastify, log, order })).resolves.toBeUndefined();
  });

  test("never throws", async () => {
    const { fastify } = makeFastify({ countThrows: true });
    await expect(announceFirstPaidOrder({ fastify, log, order })).resolves.toBeUndefined();
  });
});
