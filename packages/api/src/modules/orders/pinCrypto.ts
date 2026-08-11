import crypto from "node:crypto";

/**
 * AES-256-GCM wrapping for delivery PINs so the owning student can read the
 * code in the app. Rider verification still uses the bcrypt hash — this blob
 * is never selected on list/detail order queries, only via GET delivery-pin.
 *
 * Key is derived from JWT_SECRET so we don't need a second deploy-time secret
 * for the pilot. Rotate JWT_SECRET carefully: existing ciphertexts become
 * unreadable and GET will re-issue.
 */
function pinKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(`wave-delivery-pin:v1:${secret}`).digest();
}

/** Returns a base64url blob: iv(12) || tag(16) || ciphertext. */
export function encryptDeliveryPin(pin: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", pinKey(secret), iv);
  const enc = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptDeliveryPin(blob: string, secret: string): string {
  const buf = Buffer.from(blob, "base64url");
  if (buf.length < 12 + 16 + 1) {
    throw new Error("Invalid delivery PIN ciphertext");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", pinKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
