import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { issueDeliveryPin } from "../issuePin";
import { verifyDeliveryPin } from "../pin";
import { decryptDeliveryPin } from "../pinCrypto";
import { SmsSendError, sendDeliveryPinSms } from "../../../lib/sms";

vi.mock("../../../lib/sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/sms")>();
  return { ...actual, sendDeliveryPinSms: vi.fn() };
});

const sendMock = vi.mocked(sendDeliveryPinSms);
const JWT = "test-jwt-secret-for-pin-crypto";

function fakeFastify(apiKey?: string) {
  return {
    config: { MNOTIFY_API_KEY: apiKey, MNOTIFY_SENDER_ID: "Wave", JWT_SECRET: JWT },
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
  test("texts the plaintext PIN and persists hash + ciphertext (never plaintext)", async () => {
    const persisted: { hash: string; ciphertext: string }[] = [];
    const result = await issueDeliveryPin({
      fastify: fakeFastify("key"),
      log: fakeLog(),
      phone: "+233241234567",
      persist: async (secrets) => void persisted.push(secrets),
    });

    expect(result.smsSent).toBe(true);
    expect(result.pin).toMatch(/^\d{6}$/);
    expect(sendMock).toHaveBeenCalledTimes(1);

    const sentPin = sendMock.mock.calls[0]![0].pin;
    expect(sentPin).toBe(result.pin);

    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.hash).toMatch(/^\$2[aby]\$/);
    expect(persisted[0]!.hash).not.toContain(sentPin);
    expect(persisted[0]!.ciphertext).not.toContain(sentPin);
    expect(decryptDeliveryPin(persisted[0]!.ciphertext, JWT)).toBe(sentPin);
    expect(await verifyDeliveryPin(sentPin, persisted[0]!.hash)).toBe(true);
  });

  test("persists secrets before sending, so a delivered PIN always verifies", async () => {
    const order: string[] = [];
    sendMock.mockImplementation(async () => void order.push("sms"));

    await issueDeliveryPin({
      fastify: fakeFastify("key"),
      log: fakeLog(),
      phone: "+233241234567",
      persist: async () => void order.push("persist"),
    });

    expect(order).toEqual(["persist", "sms"]);
  });

  test("reports smsSent false when the send fails, leaving secrets stored", async () => {
    sendMock.mockRejectedValue(new SmsSendError(400, "insufficient balance"));
    const persisted: unknown[] = [];

    const result = await issueDeliveryPin({
      fastify: fakeFastify("key"),
      log: fakeLog(),
      phone: "+233241234567",
      persist: async (secrets) => void persisted.push(secrets),
    });

    expect(result.smsSent).toBe(false);
    expect(result.pin).toMatch(/^\d{6}$/);
    expect(persisted).toHaveLength(1);
  });

  test("does not log the PIN when the send fails", async () => {
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
      persist: async () => undefined,
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
      persist: async () => undefined,
    });

    expect(result.smsSent).toBe(false);
    expect(result.pin).toMatch(/^\d{6}$/);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
