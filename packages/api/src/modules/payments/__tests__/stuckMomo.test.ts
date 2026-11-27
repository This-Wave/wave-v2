import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";

const { capturePaymentIssue } = vi.hoisted(() => ({ capturePaymentIssue: vi.fn() }));
vi.mock("../../../lib/sentry", () => ({ capturePaymentError: vi.fn(), capturePaymentIssue }));

import { resetStuckMomoAlerts, sweepStuckMomo } from "../stuckMomo";

const NOW = new Date("2026-11-27T12:00:00Z");
const ago = (min: number) => NOW.getTime() - min * 60_000;
const log = { warn: vi.fn(), info: vi.fn() } as unknown as FastifyBaseLogger;

function fastifyWith(rows: Record<string, unknown>[]) {
  return { prisma: { order: { findMany: vi.fn().mockResolvedValue(rows) } } } as unknown as FastifyInstance;
}
const row = (minutes: number, extra: Record<string, unknown> = {}) => ({
  id: "o1",
  paidAt: null,
  paystackRef: `WAVEM-o1-${ago(minutes)}`,
  goodsPaidAt: null,
  goodsPaystackRef: null,
  ...extra,
});

beforeEach(() => {
  capturePaymentIssue.mockReset();
  resetStuckMomoAlerts();
});

describe("sweepStuckMomo", () => {
  test("flags a charge unpaid after 5+ minutes", async () => {
    const res = await sweepStuckMomo({ fastify: fastifyWith([row(8)]), log, now: NOW });
    expect(res.flagged).toBe(1);
    expect(capturePaymentIssue).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ orderId: "o1", phase: "stuck_momo" }));
  });

  test("leaves a charge that is still inside a normal approval window", async () => {
    expect((await sweepStuckMomo({ fastify: fastifyWith([row(2)]), log, now: NOW })).flagged).toBe(0);
  });

  test("leaves a charge the abandoned sweep already owns", async () => {
    expect((await sweepStuckMomo({ fastify: fastifyWith([row(60)]), log, now: NOW })).flagged).toBe(0);
  });

  test("alerts once per charge", async () => {
    const f = fastifyWith([row(8)]);
    await sweepStuckMomo({ fastify: f, log, now: NOW });
    expect((await sweepStuckMomo({ fastify: f, log, now: NOW })).flagged).toBe(0);
    expect(capturePaymentIssue).toHaveBeenCalledTimes(1);
  });

  test("ignores a leg that is already paid, and flags an unpaid goods leg", async () => {
    const paid = row(8, { paidAt: new Date(), goodsPaystackRef: `WAVEMGOODS-o1-${ago(9)}` });
    const res = await sweepStuckMomo({ fastify: fastifyWith([paid]), log, now: NOW });
    expect(res.flagged).toBe(1);
    expect(capturePaymentIssue.mock.calls[0]![1].reference).toMatch(/^WAVEMGOODS-/);
  });
});
