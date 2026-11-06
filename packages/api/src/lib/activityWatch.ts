import type { FastifyBaseLogger } from "fastify";

/**
 * Live Telegram reports of what a test account (`Profile.isTest`) does.
 *
 * Requests are batched into one message per account every FLUSH_MS, because a
 * single screen fires several requests and a message each would bury the chat.
 * Reads are reported once per REPEAT_READ_MS: the app re-polls open screens,
 * and "viewed My orders" every 15 seconds says nothing new. Sign-in and
 * sign-out skip the batch and go at once.
 */

const FLUSH_MS = 30_000;
const REPEAT_READ_MS = 10 * 60_000;
const SEND_TIMEOUT_MS = 5_000;
// Telegram rejects messages over 4096 characters.
const MAX_LINES = 40;

const LABELS: Record<string, string> = {
  "GET /v1/profile/me": "Opened the app",
  "PUT /v1/profile/me": "Edited their profile",
  "GET /v1/universities": "Viewed universities",
  "GET /v1/universities/:id/checkpoints": "Viewed delivery checkpoints",
  "GET /v1/zones": "Viewed delivery zones",
  "GET /v1/shops": "Browsed shops",
  "GET /v1/shops/:id": "Opened a shop",
  "GET /v1/shops/:shopId/products": "Viewed a shop's menu",
  "GET /v1/loyalty": "Viewed loyalty card",
  "GET /v1/features": "Loaded app features",
  "POST /v1/orders": "Placed an order",
  "GET /v1/orders/my": "Viewed My orders",
  "GET /v1/orders/:id": "Opened an order",
  "GET /v1/orders/:id/delivery-pin": "Viewed a delivery PIN",
  "POST /v1/orders/:id/resend-pin": "Asked for a new delivery PIN",
  "PATCH /v1/orders/:id/cancel": "Cancelled an order",
  "POST /v1/orders/:id/confirm-receipt": "Confirmed receiving an order",
  "POST /v1/payments/initiate": "Started a payment (Paystack checkout)",
  "POST /v1/payments/initiate-goods": "Started paying for goods",
  "GET /v1/payments/verify/:ref": "Checked a payment",
  "POST /v1/admin/refund-requests": "Asked for a refund",
  "POST /v1/group-baskets": "Started a group basket",
  "GET /v1/group-baskets/:code": "Opened a group basket",
  "POST /v1/group-baskets/:code/items": "Added to a group basket",
  "POST /v1/shop-suggestions": "Suggested a shop",
  "POST /v1/notifications/token": "Turned on notifications",
  "DELETE /v1/notifications/token": "Turned off notifications",
};

export function describeRequest(method: string, route: string, status: number): string {
  const label = LABELS[`${method} ${route}`] ?? `${method} ${route}`;
  return status >= 400 ? `${label} — failed (${status})` : label;
}

interface Pending {
  name: string;
  lines: { at: Date; text: string; count: number }[];
}

export interface ActivityWatch {
  record(userId: string, name: string, method: string, text: string): void;
  sendNow(name: string, text: string): Promise<void>;
  stop(): Promise<void>;
}

/** Ghana is on GMT all year, so UTC is local time. */
function clock(at: Date): string {
  return at.toISOString().slice(11, 19);
}

export function createActivityWatch(opts: {
  botToken?: string;
  chatId?: string;
  log: FastifyBaseLogger;
}): ActivityWatch | null {
  const { botToken, chatId, log } = opts;
  if (!botToken || !chatId) return null;

  const pending = new Map<string, Pending>();
  const lastRead = new Map<string, number>();

  async function send(text: string): Promise<void> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!res.ok) log.warn({ status: res.status }, "Telegram activity alert was refused");
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : "unknown" }, "Telegram activity alert failed");
    }
  }

  async function flush(): Promise<void> {
    const batches = [...pending.values()];
    pending.clear();
    for (const { name, lines } of batches) {
      const shown = lines.slice(0, MAX_LINES).map((l) => `${clock(l.at)}  ${l.text}${l.count > 1 ? ` ×${l.count}` : ""}`);
      if (lines.length > MAX_LINES) shown.push(`…and ${lines.length - MAX_LINES} more`);
      await send(`${name}\n${shown.join("\n")}`);
    }
  }

  const timer = setInterval(() => void flush(), FLUSH_MS);
  timer.unref();

  return {
    record(userId, name, method, text) {
      if (method === "GET") {
        const key = `${userId} ${text}`;
        const last = lastRead.get(key);
        if (last && Date.now() - last < REPEAT_READ_MS) return;
        lastRead.set(key, Date.now());
      }
      const batch = pending.get(userId) ?? { name, lines: [] };
      const prev = batch.lines[batch.lines.length - 1];
      if (prev && prev.text === text) prev.count += 1;
      else batch.lines.push({ at: new Date(), text, count: 1 });
      pending.set(userId, batch);
    },
    async sendNow(name, text) {
      // Otherwise "Signed out" lands before the summary of what came before it.
      await flush();
      await send(`${name}\n${clock(new Date())}  ${text}`);
    },
    async stop() {
      clearInterval(timer);
      await flush();
    },
  };
}
