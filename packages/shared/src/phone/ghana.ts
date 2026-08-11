/** Ghana mobile numbers without country code — 9 digits, no trunk zero. */
export const GHANA_LOCAL_PHONE_LENGTH = 9;

/**
 * Normalizes what a user typed into the local (+233) field.
 * Strips formatting, leading 0 (024… → 24…), and a pasted 233 country prefix.
 */
export function normalizeGhanaLocalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  digits = digits.replace(/^0+/, "");
  if (digits.startsWith("233")) {
    digits = digits.slice(3).replace(/^0+/, "");
  }
  return digits;
}

/** E.164 Ghana number from local digits shown beside the +233 prefix. */
export function toGhanaE164(localDigits: string): string {
  return `+233${normalizeGhanaLocalDigits(localDigits)}`;
}
