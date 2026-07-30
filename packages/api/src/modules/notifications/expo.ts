import axios from "axios";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Expo rejects requests carrying more than 100 messages.
const MAX_MESSAGES_PER_REQUEST = 100;

/**
 * Carries only what is safe to log, for the same reason `SmsSendError` does
 * (see `lib/sms.ts`): a raw axios error serializes `config.data`, which here is
 * every recipient's push token plus the message bodies.
 */
export class PushSendError extends Error {
  constructor(
    readonly status?: number,
    readonly providerMessage?: string,
  ) {
    super(
      `Expo push send failed${status ? ` (HTTP ${status})` : ""}` +
        `${providerMessage ? `: ${providerMessage}` : ""}`,
    );
    this.name = "PushSendError";
  }
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Android only — must match a channel created on the device. */
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * A token the device is no longer reachable on — the app was uninstalled, or
 * the token was rotated. Expo returns this per-message, and the documented
 * response is to stop sending to it, so callers null the stored token out.
 */
export const DEVICE_NOT_REGISTERED = "DeviceNotRegistered";

// Cheap shape check so an obviously-bad value never costs a network round
// trip. Expo issues both prefixes; FCM/APNs raw tokens are not accepted here.
const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export function isExpoPushToken(token: string): boolean {
  return EXPO_TOKEN_PATTERN.test(token);
}

/**
 * Sends a batch and returns one ticket per message, in the order given.
 *
 * A ticket is an *acceptance* receipt, not proof of delivery — Expo hands off
 * to FCM/APNs asynchronously. That is fine for Wave: order updates are also
 * visible by pulling to refresh, so a push is an accelerator, never the only
 * copy of the information.
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];

  const tickets: ExpoPushTicket[] = [];
  for (let i = 0; i < messages.length; i += MAX_MESSAGES_PER_REQUEST) {
    const batch = messages.slice(i, i + MAX_MESSAGES_PER_REQUEST);
    try {
      const { data } = await axios.post<{ data: ExpoPushTicket[] }>(EXPO_PUSH_URL, batch, {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      tickets.push(...(data.data ?? []));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const providerMessage =
          err.response?.data?.errors?.[0]?.message ?? err.response?.data?.message;
        throw new PushSendError(err.response?.status, providerMessage);
      }
      throw new PushSendError();
    }
  }
  return tickets;
}
