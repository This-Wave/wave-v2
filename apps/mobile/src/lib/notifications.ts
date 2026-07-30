import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "./api";

/**
 * Must match `ORDERS_CHANNEL_ID` in the API's notification dispatcher. On
 * Android a notification naming a channel the device never created arrives
 * silently, so this has to be set up before the first push can land.
 */
const ORDERS_CHANNEL_ID = "orders";

/**
 * Foreground behaviour. Wave's notifications are order updates the student is
 * usually waiting on, so they are worth interrupting for even with the app
 * open — the alternative is a student staring at a stale tracking screen.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL_ID, {
    name: "Order updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#009933",
  });
}

/**
 * `getExpoPushTokenAsync` needs the EAS project id, and in a bare Expo Go run
 * it can be missing entirely. Read it from whichever config shape is present
 * rather than assuming one.
 */
function getProjectId(): string | undefined {
  const fromEas = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const fromEasConfig = (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return fromEas || fromEasConfig || undefined;
}

export type PushRegistrationResult =
  | { status: "registered"; token: string }
  | { status: "denied" }
  | { status: "unavailable"; reason: string };

/**
 * Asks for permission, gets this device's Expo push token, and hands it to the
 * API.
 *
 * Safe to call on every launch, and safe to call where push cannot work at all
 * (a simulator, or before the EAS project id is configured) — it reports why
 * and returns rather than throwing into the auth flow. Push is an accelerator;
 * every state it announces is also reachable by opening the app.
 */
export async function registerPushToken(): Promise<PushRegistrationResult> {
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return { status: "denied" };

    const projectId = getProjectId();
    if (!projectId) {
      // app.json ships `extra.eas.projectId: ""` — nobody has run `eas init`
      // yet. Expo cannot mint a token without it.
      return { status: "unavailable", reason: "No EAS projectId configured" };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post("/notifications/token", { token });
    return { status: "registered", token };
  } catch (err) {
    // Simulators have no push service, and a signed-out client will 401 here.
    // Neither is worth surfacing to the user.
    return {
      status: "unavailable",
      reason: err instanceof Error ? err.message : "Push registration failed",
    };
  }
}

/**
 * Detaches this device from the signed-out account, so the next person to sign
 * in here does not receive the previous user's order notifications.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    await api.delete("/notifications/token");
  } catch {
    // Best-effort: the token is also reassigned server-side the moment another
    // account registers this same device.
  }
}
