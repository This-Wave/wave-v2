import webpush from "web-push";

/**
 * Web Push: notifications for the web app, chiefly once it is added to a home
 * screen (Android Chrome, and iOS 16.4+ which allows it only from the home
 * screen). Free — the browser vendors' push services carry the messages.
 *
 * Off unless all three VAPID settings are present, like mNotify and Telegram.
 */

export interface VapidConfig {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export interface WebPushTarget {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** A day: an order notification that old is noise, and the app shows the state anyway. */
const TTL_SECONDS = 24 * 60 * 60;

let configuredWith: string | null = null;

export function webPushEnabled(config: VapidConfig): boolean {
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = config;
  if (!pub || !priv || !subject) return false;
  if (configuredWith !== pub) {
    webpush.setVapidDetails(subject, pub, priv);
    configuredWith = pub;
  }
  return true;
}

/**
 * Sends one payload to each subscription. Returns the ids of subscriptions the
 * push service says are gone (404/410: uninstalled, or permission revoked), so
 * the caller can delete them.
 */
export async function sendWebPush(
  targets: WebPushTarget[],
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<{ sent: number; failed: number; gone: string[] }> {
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    targets.map((t) =>
      webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body, {
        TTL: TTL_SECONDS,
        urgency: "high",
        timeout: 10_000,
      }),
    ),
  );

  const gone: string[] = [];
  let sent = 0;
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sent += 1;
      return;
    }
    const status = (r.reason as { statusCode?: number } | undefined)?.statusCode;
    if (status === 404 || status === 410) gone.push(targets[i]!.id);
    else failed += 1;
  });
  return { sent, failed, gone };
}
