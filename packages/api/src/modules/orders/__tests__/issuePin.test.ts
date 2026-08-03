import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { issueDeliveryPin } from "../issuePin";
import { verifyDeliveryPin } from "../pin";
import { SmsSendError, sendDeliveryPinSms } from "../../../lib/sms";

vi.mock("../../../lib/sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/sms")>();
  return { ...actual, sendDeliveryPinSms: vi.fn() };
});

const sendMock = vi.mocked(sendDeliveryPinSms);

function fakeFastify(apiKey?: string) {
  return {
    config: { MNOTIFY_API_KEY: apiKey, MNOTIFY_SENDER_ID: "Wave" },
  } as unknown as FastifyInstance;
}

function fakeLog() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as FastifyBaseLogger;
}

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue(undefined);
});

describe("issueDeliveryPin", () => {
  test("texts the plaintext PIN and persists only its hash", async () => {
    const persisted: string[] = [];
    const result = await issueDeliveryPin({
      fastify: fakeFastify("key"),
      log: fakeLog(),
      phone: "+233241234567",
      persistHash: async (hash) => void persisted.push(hash),
    });

    expect(result.smsSent).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);

    const sentPin = sendMock.mock.calls[0]![0].pin;
    expect(sentPin).toMatch(/^\d{6}$/);

    // Exactly one hash written, and it is a bcrypt hash — not the PIN itself.
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatch(/^\$2[aby]\$/);
    expect(persisted[0]).not.toContain(sentPin);

    // The transmitted PIN is the one the stored hash will verify.
    expect(await verifyDeliveryPin(sentPin, persisted[0]!)).toBe(true);
  });

  test("persists the hash before sending, so a delivered PIN always verifies", async () => {
    const order: string[] = [];
    sendMock.mockImplementation(async () => void order.push("sms"));

    await issueDeliveryPin({
      fastify: fakeFastify("key"),
      log: fakeLog(),
      phone: "+233241234567",
      persistHash: async () => void order.push("persist"),
    });

    expect(order).toEqual(["persist", "sms"]);
  });

  test("reports smsSent false when the send fails, leaving the hash stored", async () => {
    sendMock.mockRejectedValue(new SmsSendError(400, "insufficient balance"));
    const persisted: string[] = [];

    const result = await issueDeliveryPin({
      fastify: fakeFastify("key"),
      log: fakeLog(),
      phone: "+233241234567",
      persistHash: async (hash) => void persisted.push(hash),
    });

    expect(result.smsSent).toBe(false);
    expect(persisted).toHaveLength(1);
  });

  test("does not log the PIN when the send fails", async () => {
    sendMock.mockRejectedValue(new SmsSendError(500, "provider down"));
    const log = fakeLog();
    let capturedPin = "";
    sendMock.mockImplementation(async (params) => {
      capturedPin = params.pin;
      throw new SmsSendError(500, "provider down");
    });

    await issueDeliveryPin({
      fastify: fakeFastify("key"),
      log,
      phone: "+233241234567",
      persistHash: async () => undefined,
    });

    const logged = JSON.stringify(vi.mocked(log.error).mock.calls);
    expect(capturedPin).toMatch(/^\d{6}$/);
    expect(logged).not.toContain(capturedPin);
  });

  test("skips the send entirely when mNotify is not configured", async () => {
    const result = await issueDeliveryPin({
      fastify: fakeFastify(undefined),
      log: fakeLog(),
      phone: "+233241234567",
      persistHash: async () => undefined,
    });

    expect(result.smsSent).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
