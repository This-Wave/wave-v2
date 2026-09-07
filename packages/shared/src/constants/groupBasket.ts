import { MAX_ITEM_QUANTITY, MAX_ORDER_ITEMS } from "./platform";

/**
 * Group baskets: the rules, without a database.
 *
 * One student starts a basket, shares a code, friends add items, the starter
 * pays once. Everything here is the part worth testing on its own — who may do
 * what, and what a code looks like.
 */

export type GroupBasketStatus = "open" | "locked" | "converted" | "expired";

/**
 * Join-code alphabet.
 *
 * No 0/O, no 1/I/L. The code gets read aloud across a hostel room and typed by
 * someone who did not hear it clearly, and those pairs are where that goes
 * wrong. 28 usable characters over 6 places is ~480 million combinations, which
 * is far more than a campus will ever have open at once.
 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;

export function isValidBasketCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((c) => CODE_ALPHABET.includes(c));
}

/** Uppercases and strips the spaces people add when reading a code aloud. */
export function normalizeBasketCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Generate a code. `random` is injectable so the test does not depend on luck,
 * and so the caller can retry on the (vanishingly rare) collision.
 */
export function generateBasketCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return out;
}

export const MAX_BASKET_ITEMS = MAX_ORDER_ITEMS;
export const MAX_BASKET_ITEM_QUANTITY = MAX_ITEM_QUANTITY;

export type BasketRefusal =
  | "not-open"
  | "cutoff-passed"
  | "too-many-items"
  | "quantity-too-high";

/**
 * Whether someone may add to this basket right now.
 *
 * The case this exists for: a friend adding an item *while* the starter is on
 * the payment screen. The starter locks before paying, so this returns
 * `not-open` and the friend is told why — rather than the total silently moving
 * under someone who is about to authorise it.
 */
export function canAddToBasket(args: {
  status: GroupBasketStatus;
  itemCount: number;
  quantity: number;
  cutoffPassed: boolean;
}): BasketRefusal | null {
  if (args.status !== "open") return "not-open";
  if (args.cutoffPassed) return "cutoff-passed";
  if (args.itemCount >= MAX_BASKET_ITEMS) return "too-many-items";
  if (args.quantity < 1 || args.quantity > MAX_BASKET_ITEM_QUANTITY) return "quantity-too-high";
  return null;
}

/** The sentence the person who was refused should read. */
export function basketRefusalMessage(refusal: BasketRefusal): string {
  switch (refusal) {
    case "not-open":
      return "This basket is being paid for, so nothing more can be added. Ask whoever started it to open a new one.";
    case "cutoff-passed":
      return "This Wave has closed. Start a new basket for the next one.";
    case "too-many-items":
      return `A basket holds ${MAX_BASKET_ITEMS} lines. Remove something before adding more.`;
    case "quantity-too-high":
      return `Quantity has to be between 1 and ${MAX_BASKET_ITEM_QUANTITY}.`;
  }
}

/**
 * Only the starter pays, and only they can lock or cancel.
 *
 * Anyone at the same university may *add* — the code is the invitation, and
 * requiring an approval step for each friend would make a group order slower
 * than four separate ones.
 */
export function canLockBasket(args: { starterId: string; actorId: string }): boolean {
  return args.starterId === args.actorId;
}

/** What each person owes the starter. The app shows it; Wave never collects it. */
export function splitByPerson(
  items: { profileId: string; unitPrice: number | null; quantity: number }[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) {
    const line = (item.unitPrice ?? 0) * item.quantity;
    totals.set(item.profileId, round2((totals.get(item.profileId) ?? 0) + line));
  }
  return totals;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
