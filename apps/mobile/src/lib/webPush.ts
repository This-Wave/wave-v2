import { Platform } from "react-native";
import { api } from "./api";

/**
 * Notifications for the web app (Web Push). Native builds use Expo push
 * (`notifications.ts`) and never reach this code.
 *
 * Where it works: Android Chrome, in a tab or added to the home screen; iPhone
 * and iPad on iOS 16.4+, ONLY once added to the home screen; desktop browsers.
 *
 * The permission prompt must come from a tap. Safari ignores a request that
 * isn't, and Chrome quietly blocks sites that prompt on load — so nothing here
 * asks on its own. `enableWebPush` is for a button's onPress.
 */

export type WebPushState =
  /** Native, an old browser, or the server has web push turned off. */
  | "unsupported"
  /** iPhone/iPad in a Safari tab: works after "Add to Home Screen". */
  | "needs-install"
  /** The person said no; only browser settings can undo that. */
  | "blocked"
  | "off"
  | "on";

function hasPushApis(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports itself as a Mac; the touch points give it away.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

let keyRequest: Promise<string | null> | null = null;

function serverKey(): Promise<string | null> {
  keyRequest ??= api
    .get<{ publicKey: string | null }>("/notifications/web-push/key")
    .then((res) => res.data.publicKey)
    .catch(() => {
      keyRequest = null;
      return null;
    });
  return keyRequest;
}

function keyBytes(base64Url: string): Uint8Array {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const bytes = new Uint8Array(a);
  return bytes.length === b.length && bytes.every((v, i) => v === b[i]);
}

export async function getWebPushState(): Promise<WebPushState> {
  if (Platform.OS !== "web" || typeof window === "undefined") return "unsupported";
  // Safari only exposes PushManager to a home-screen app, so a tab lands here.
  if (!hasPushApis()) return isIos() && !isInstalled() ? "needs-install" : "unsupported";
  if (!(await serverKey())) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

/** Subscribes this browser (if it isn't) and hands the subscription to the API. */
async function subscribeAndRegister(): Promise<void> {
  const key = await serverKey();
  if (!key) throw new Error("Web push is not configured on the server");
  const applicationServerKey = keyBytes(key);

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  // A subscription made under an old server key can't receive anything now.
  if (subscription && !sameKey(subscription.options.applicationServerKey, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  await api.post("/notifications/web-push", subscription.toJSON());
}

/** For the "Turn on" button. Asks first, while the tap still counts. */
export async function enableWebPush(): Promise<WebPushState> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";
  await subscribeAndRegister();
  return "on";
}

/**
 * On every signed-in launch: re-attaches an existing subscription to whoever
 * is signed in now. Never prompts.
 */
export async function syncWebPush(): Promise<void> {
  try {
    if (!hasPushApis() || Notification.permission !== "granted") return;
    await subscribeAndRegister();
  } catch {
    // Push is an accelerator; the app works without it.
  }
}

/** Turning it off, and on sign-out so the next person here gets nothing of ours. */
export async function disableWebPush(): Promise<void> {
  try {
    if (!hasPushApis()) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await api.delete("/notifications/web-push", { data: { endpoint: subscription.endpoint } }).catch(() => undefined);
    await subscription.unsubscribe();
  } catch {
    // Best-effort, like `unregisterPushToken`.
  }
}

/** A notification tapped while the app was closed opens `/?order=<id>`. */
export function consumeOpenOrderParam(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const orderId = url.searchParams.get("order");
  if (!orderId) return null;
  url.searchParams.delete("order");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  return orderId;
}
