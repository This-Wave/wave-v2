import { describe, expect, it, vi } from "vitest";
import { normalizeShopName } from "@wave/shared";
import { shopLiveEmail } from "../../../lib/email";

/**
 * The ranking is only as good as the normalization: if two spellings of one
 * shop hash to different keys, the demand signal splits and the most-wanted
 * place looks like three unpopular ones.
 */
describe("normalizeShopName", () => {
  it("collapses the spellings of one place onto one key", () => {
    const key = normalizeShopName("Melcom Berekuso");
    expect(normalizeShopName("MELCOM  BEREKUSO")).toBe(key);
    expect(normalizeShopName("  melcom berekuso  ")).toBe(key);
    expect(normalizeShopName("Melcom, Berekuso!")).toBe(key);
    expect(normalizeShopName("Melcom-Berekuso")).toBe(key);
  });

  it("keeps genuinely different places apart", () => {
    expect(normalizeShopName("Melcom")).not.toBe(normalizeShopName("Melcom Berekuso"));
    expect(normalizeShopName("Shoprite")).not.toBe(normalizeShopName("Melcom"));
  });

  it("keeps digits, which are often the distinguishing part of a name", () => {
    // The slash separates rather than vanishes, for the same reason a hyphen
    // does — so this matches someone who typed "Shop 24 7".
    expect(normalizeShopName("Shop 24/7")).toBe("shop 24 7");
    expect(normalizeShopName("Shop 24 7")).toBe(normalizeShopName("Shop 24/7"));
  });
});

describe("shopLiveEmail", () => {
  it("greets by first name and names the shop", () => {
    const mail = shopLiveEmail({ studentName: "Ama Serwaa Mensah", shopName: "Melcom" });
    expect(mail.subject).toBe("Melcom is now on Wave");
    expect(mail.text).toContain("Hi Ama,");
    expect(mail.html).toContain("Melcom");
  });

  it("escapes a shop name so a quote in it cannot break the markup", () => {
    const mail = shopLiveEmail({
      studentName: "Kofi",
      shopName: '<script>alert("x")</script>',
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("falls back when a name is a single word or empty", () => {
    expect(shopLiveEmail({ studentName: "", shopName: "Melcom" }).text).toContain("Hi there,");
  });
});

/**
 * `announceShopIsLive` is best-effort by contract: onboarding a shop must
 * succeed whether or not Resend and Expo are reachable. These assert the
 * swallowing, because a throw here would roll an admin action back after the
 * database had already committed it.
 */
describe("announceShopIsLive", () => {
  async function load() {
    const { announceShopIsLive } = await import("../announce");
    return announceShopIsLive;
  }

  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() } as never;

  it("does nothing at all when nobody suggested the shop", async () => {
    const announce = await load();
    const findMany = vi.fn();
    const result = await announce({
      fastify: { prisma: { profile: { findMany } } } as never,
      log,
      studentIds: [],
      shopId: "shop-1",
      shopName: "Melcom",
    });
    expect(result).toEqual({ emailed: 0, pushed: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("skips students with no email rather than failing on them", async () => {
    const announce = await load();
    const fastify = {
      config: { RESEND_API_KEY: undefined, RESEND_FROM: "Wave <x@wave.app>" },
      prisma: {
        profile: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              { id: "s1", fullName: "Ama", email: null },
              { id: "s2", fullName: "Kofi", email: "kofi@example.com" },
            ])
            // the push fan-out's own lookup
            .mockResolvedValue([]),
        },
      },
    } as never;

    const result = await announce({
      fastify,
      log,
      studentIds: ["s1", "s2"],
      shopId: "shop-1",
      shopName: "Melcom",
    });

    // No API key configured, so nothing actually sends — and crucially it does
    // not throw. That no-op is what keeps CI and local dev offline.
    expect(result.emailed).toBe(0);
  });

  it("swallows a database failure instead of rolling back the onboarding", async () => {
    const announce = await load();
    const fastify = {
      config: { RESEND_FROM: "Wave <x@wave.app>" },
      prisma: { profile: { findMany: vi.fn().mockRejectedValue(new Error("neon is down")) } },
    } as never;

    await expect(
      announce({ fastify, log, studentIds: ["s1"], shopId: "shop-1", shopName: "Melcom" }),
    ).resolves.toEqual({ emailed: 0, pushed: 0 });
  });
});
