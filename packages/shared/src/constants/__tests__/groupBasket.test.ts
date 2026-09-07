import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_BASKET_ITEMS,
  MAX_BASKET_ITEM_QUANTITY,
  basketRefusalMessage,
  canAddToBasket,
  canLockBasket,
  generateBasketCode,
  isValidBasketCode,
  normalizeBasketCode,
  splitByPerson,
} from "../groupBasket";

describe("join codes", () => {
  it("never contains a character people confuse when reading aloud", () => {
    for (const bad of ["0", "O", "1", "I", "L"]) {
      expect(CODE_ALPHABET).not.toContain(bad);
    }
  });

  it("generates codes of the right shape", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateBasketCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(isValidBasketCode(code)).toBe(true);
    }
  });

  it("is deterministic when the randomness is", () => {
    const fixed = () => 0;
    expect(generateBasketCode(fixed)).toBe(CODE_ALPHABET.charAt(0).repeat(CODE_LENGTH));
  });

  it("rejects the wrong length and unknown characters", () => {
    expect(isValidBasketCode("ABC")).toBe(false);
    expect(isValidBasketCode("ABCDEFG")).toBe(false);
    expect(isValidBasketCode("ABCDE0")).toBe(false);
  });

  it("forgives how people actually type a code they were read", () => {
    expect(normalizeBasketCode(" ab2 c3d ")).toBe("AB2C3D");
    expect(normalizeBasketCode("AB2-C3D")).toBe("AB2C3D");
  });
});

describe("canAddToBasket", () => {
  const ok = { status: "open" as const, itemCount: 2, quantity: 1, cutoffPassed: false };

  it("allows a normal add", () => {
    expect(canAddToBasket(ok)).toBeNull();
  });

  /** The case this whole function exists for. */
  it("refuses once the starter has locked to pay", () => {
    expect(canAddToBasket({ ...ok, status: "locked" })).toBe("not-open");
    expect(canAddToBasket({ ...ok, status: "converted" })).toBe("not-open");
    expect(canAddToBasket({ ...ok, status: "expired" })).toBe("not-open");
  });

  it("refuses after the Wave closes", () => {
    expect(canAddToBasket({ ...ok, cutoffPassed: true })).toBe("cutoff-passed");
  });

  it("refuses a basket that is already full", () => {
    expect(canAddToBasket({ ...ok, itemCount: MAX_BASKET_ITEMS })).toBe("too-many-items");
  });

  it("refuses an impossible quantity", () => {
    expect(canAddToBasket({ ...ok, quantity: 0 })).toBe("quantity-too-high");
    expect(canAddToBasket({ ...ok, quantity: MAX_BASKET_ITEM_QUANTITY + 1 })).toBe(
      "quantity-too-high",
    );
  });

  it("checks the lock before the cutoff, so the message names the real blocker", () => {
    expect(canAddToBasket({ ...ok, status: "locked", cutoffPassed: true })).toBe("not-open");
  });

  it("has a sentence for every refusal", () => {
    for (const r of ["not-open", "cutoff-passed", "too-many-items", "quantity-too-high"] as const) {
      expect(basketRefusalMessage(r).length).toBeGreaterThan(10);
    }
  });
});

describe("canLockBasket", () => {
  it("is the starter's call alone", () => {
    expect(canLockBasket({ starterId: "a", actorId: "a" })).toBe(true);
    expect(canLockBasket({ starterId: "a", actorId: "b" })).toBe(false);
  });
});

describe("splitByPerson", () => {
  it("adds each person's lines up", () => {
    const split = splitByPerson([
      { profileId: "ama", unitPrice: 35, quantity: 1 },
      { profileId: "kofi", unitPrice: 28, quantity: 2 },
      { profileId: "ama", unitPrice: 12.5, quantity: 2 },
    ]);
    expect(split.get("ama")).toBe(60);
    expect(split.get("kofi")).toBe(56);
  });

  it("counts an unpriced line as zero rather than dropping the person", () => {
    const split = splitByPerson([{ profileId: "abena", unitPrice: null, quantity: 3 }]);
    expect(split.get("abena")).toBe(0);
  });

  it("does not accumulate floating-point noise", () => {
    const split = splitByPerson([
      { profileId: "p", unitPrice: 0.1, quantity: 1 },
      { profileId: "p", unitPrice: 0.2, quantity: 1 },
    ]);
    expect(split.get("p")).toBe(0.3);
  });
});
