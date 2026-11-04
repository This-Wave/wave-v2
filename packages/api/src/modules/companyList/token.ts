import { createHash, randomBytes } from "node:crypto";

/** A new list-link token: 32 random bytes, URL-safe. */
export function newListToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashListToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
