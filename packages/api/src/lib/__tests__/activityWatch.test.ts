import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyBaseLogger } from "fastify";
import { createActivityWatch, describeRequest } from "../activityWatch";

const log = { warn: vi.fn() } as unknown as FastifyBaseLogger;

describe("activityWatch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function sentTexts(): string[] {
    return fetchMock.mock.calls.map(([, init]) => (JSON.parse(init.body as string) as { text: string }).text);
  }

  it("is off unless both the bot token and chat id are set", () => {
    expect(createActivityWatch({ botToken: "t", log })).toBeNull();
    expect(createActivityWatch({ chatId: "c", log })).toBeNull();
  });

  it("batches one account's actions into a single message, collapsing repeats", async () => {
    const watch = createActivityWatch({ botToken: "t", chatId: "c", log })!;
    watch.record("u1", "Test account: Ama", "POST", "Placed an order");
    watch.record("u1", "Test account: Ama", "POST", "Started a payment (Paystack checkout)");
    watch.record("u1", "Test account: Ama", "POST", "Started a payment (Paystack checkout)");
    await watch.stop();

    expect(sentTexts()).toHaveLength(1);
    expect(sentTexts()[0]).toMatch(/^Test account: Ama\n.*Placed an order\n.*Started a payment \(Paystack checkout\) ×2$/);
  });

  it("reports a repeated read once, so screen polling stays quiet", async () => {
    const watch = createActivityWatch({ botToken: "t", chatId: "c", log })!;
    watch.record("u1", "Ama", "GET", "Viewed My orders");
    watch.record("u1", "Ama", "POST", "Placed an order");
    watch.record("u1", "Ama", "GET", "Viewed My orders");
    await watch.stop();

    expect(sentTexts()[0]!.match(/Viewed My orders/g)).toHaveLength(1);
  });

  it("sends pending activity before an immediate message", async () => {
    const watch = createActivityWatch({ botToken: "t", chatId: "c", log })!;
    watch.record("u1", "Ama", "POST", "Placed an order");
    await watch.sendNow("Ama", "Signed out");
    await watch.stop();

    expect(sentTexts()).toHaveLength(2);
    expect(sentTexts()[0]).toMatch(/Placed an order/);
    expect(sentTexts()[1]).toMatch(/Signed out/);
  });

  it("never throws when Telegram is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const watch = createActivityWatch({ botToken: "t", chatId: "c", log })!;
    await expect(watch.sendNow("Ama", "Signed in")).resolves.toBeUndefined();
    await watch.stop();
  });

  it("labels known routes and marks failures", () => {
    expect(describeRequest("POST", "/v1/orders", 201)).toBe("Placed an order");
    expect(describeRequest("POST", "/v1/orders", 422)).toBe("Placed an order — failed (422)");
    expect(describeRequest("GET", "/v1/somewhere/new", 200)).toBe("GET /v1/somewhere/new");
  });
});
