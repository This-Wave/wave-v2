import bcrypt from "bcrypt";
import crypto from "node:crypto";

export async function generateDeliveryPin(): Promise<{ pin: string; hash: string }> {
  const pin = crypto.randomInt(100000, 999999).toString();
  const hash = await bcrypt.hash(pin, 10);
  return { pin, hash };
}

export async function verifyDeliveryPin(inputPin: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(inputPin, storedHash);
}
