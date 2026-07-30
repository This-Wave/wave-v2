import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { generateDeliveryPin } from "./pin";
import { SmsSendError, sendDeliveryPinSms } from "../../lib/sms";

export interface IssueDeliveryPinArgs {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  /** E.164 phone of the student who placed the order. */
  phone: string;
  /**
   * Writes the bcrypt hash to the order. Awaited *before* the SMS goes out, so
   * a PIN in a student's hand is always one the DB can verify — never the other
   * way round.
   */
  persistHash: (hash: string) => Promise<void>;
}

/**
 * Issues a delivery PIN: generates it, persists only the bcrypt hash, and
 * texts the plaintext to the student.
 *
 * The plaintext exists only inside this function and in the SMS. It is never
 * returned, never written to the DB, and never logged — which is why a failed
 * send cannot be recovered by re-reading anything and has to be re-issued
 * (see `POST /orders/:id/resend-pin`).
 */
export async function issueDeliveryPin(args: IssueDeliveryPinArgs): Promise<{ smsSent: boolean }> {
  const { pin, hash } = await generateDeliveryPin();
  await args.persistHash(hash);

  const apiKey = args.fastify.config.MNOTIFY_API_KEY;
  if (!apiKey) {
    args.log.error("Delivery PIN issued but MNOTIFY_API_KEY is not configured — no SMS sent");
    return { smsSent: false };
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
    return { smsSent: false };
  }

  return { smsSent: true };
}
