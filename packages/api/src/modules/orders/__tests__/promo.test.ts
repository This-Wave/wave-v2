import { describe, expect, test, vi } from "vitest";
import { evaluateFirstOrderPromo } from "../promo";

function db({ pct = "25", paid = false, heldOpen = false }: { pct?: string | null; paid?: boolean; heldOpen?: boolean } = {}) {
  return {
    platformConfig: { findUnique: vi.fn().mockResolvedValue(pct === null ? null : { key: "promo_first_order_pct", value: pct }) },
    order: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(paid ? { id: "paid" } : null)
        .mockResolvedValueOnce(heldOpen ? { id: "open" } : null),
    },
  } as never;
}

describe("first-order code", () => {
  test("HELLOHILL gives 25% off a first order, however it is typed", async () => {
    await expect(evaluateFirstOrderPromo(db(), "s1", " hello hill ")).resolves.toEqual({ ok: true, code: "HELLOHILL", pct: 25 });
  });

  test("falls back to 25% when the setting row is missing", async () => {
    await expect(evaluateFirstOrderPromo(db({ pct: null }), "s1", "HELLOHILL")).resolves.toMatchObject({ ok: true, pct: 25 });
  });

  test("an unknown code is refused", async () => {
    await expect(evaluateFirstOrderPromo(db(), "s1", "FREESTUFF")).resolves.toEqual({ ok: false, error: "That code doesn't exist." });
  });

  test("0% in Config switches the code off", async () => {
    await expect(evaluateFirstOrderPromo(db({ pct: "0" }), "s1", "HELLOHILL")).resolves.toMatchObject({ ok: false, error: "That code has ended." });
  });

  test("a student who has paid before cannot use it", async () => {
    await expect(evaluateFirstOrderPromo(db({ paid: true }), "s1", "HELLOHILL")).resolves.toMatchObject({ ok: false });
  });

  test("only one unpaid order can carry it at a time", async () => {
    const res = await evaluateFirstOrderPromo(db({ heldOpen: true }), "s1", "HELLOHILL");
    expect(res).toMatchObject({ ok: false });
    expect((res as { error: string }).error).toMatch(/waiting for payment/);
  });
});
