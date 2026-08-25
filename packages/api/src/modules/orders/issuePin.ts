import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { generateDeliveryPin } from "./pin";
import { encryptDeliveryPin } from "./pinCrypto";
import { SmsSendError, sendDeliveryPinSms } from "../../lib/sms";

export interface IssueDeliveryPinArgs {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  /** E.164 phone of the student who placed the order. */
  phone: string;
  /**
   * Writes the bcrypt hash + encrypted PIN to the order. Awaited *before* the
   * SMS goes out, so a PIN in a student's hand is always one the DB can verify.
   */
  persist: (secrets: { hash: string; ciphertext: string }) => Promise<void>;
}

/**
 * Issues a delivery PIN: generates it, persists the bcrypt hash + an encrypted
 * copy for in-app display, and texts the plaintext to the student.
 *
 * The plaintext is never logged and never returned on general order GETs —
 * only `GET /orders/:id/delivery-pin` (owner) decrypts the ciphertext.
 */
export async function issueDeliveryPin(
  args: IssueDeliveryPinArgs,
): Promise<{ smsSent: boolean; pin: string }> {
  const { pin, hash } = await generateDeliveryPin();
  const ciphertext = encryptDeliveryPin(pin, args.fastify.config.JWT_SECRET);
  await args.persist({ hash, ciphertext });

  const apiKey = args.fastify.config.MNOTIFY_API_KEY;
  if (!apiKey) {
    args.log.error("Delivery PIN issued but MNOTIFY_API_KEY is not configured — no SMS sent");
    return { smsSent: false, pin };
  }

  try {
    await sendDeliveryPinSms({
      apiKey,
      senderId: args.fastify.config.MNOTIFY_SENDER_ID,
      phone: args.phone,
      pin,
    });
  } catch (err) {
    // SmsSendError deliberately carries no request body — logging the raw axios
    // error here would print the PIN.
    const detail = err instanceof SmsSendError ? err.message : "unknown SMS failure";
    args.log.error({ detail }, "Delivery PIN SMS failed");
    return { smsSent: false, pin };
  }

  return { smsSent: true, pin };
}
