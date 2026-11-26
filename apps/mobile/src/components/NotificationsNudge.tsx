import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FULL, NAV_BOTTOM_GAP } from "./v6/TabBar";
import { colors, radii } from "../theme/tokens";
import { useAuthStore } from "../store/authStore";
import { useWebPush } from "../hooks/useWebPush";
import { isStandalone } from "../lib/installPrompt";
import { hasAcceptedCookies, onCookiesAccepted } from "./CookieConsent";

const SNOOZE_KEY = "wave.notifyNudgeSnoozedAt";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return true;
  }
}

/**
 * "Turn on delivery updates", for someone running Wave from their home screen
 * with notifications still off. The install popup (`InstallHint`) covers
 * everyone before that step; this is the second half of the same ask.
 *
 * The button calls the browser's permission prompt straight from the tap, as
 * browsers require. "Not now" snoozes for three days.
 */
export function NotificationsNudge() {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const { state, busy, error, turnOn } = useWebPush();
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !profile || !isStandalone()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      timer = setTimeout(() => setReady(true), 3000);
    };
    if (hasAcceptedCookies()) show();
    const stop = onCookiesAccepted(show);
    return () => {
      stop();
      if (timer) clearTimeout(timer);
    };
  }, [profile]);

  if (!ready || hidden || state !== "off" || snoozed()) return null;

  function notNow() {
    try {
      window.localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    setHidden(true);
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, NAV_BOTTOM_GAP) + FULL + 12,
        zIndex: 9998,
        alignItems: "center",
      }}
    >
      <View style={{ width: "100%", maxWidth: 480, backgroundColor: colors.surface, borderRadius: radii.card, padding: 16 }}>
        <Text className="font-sans-bold text-body" style={{ color: colors.ink }}>
          Turn on delivery updates
        </Text>
        <Text className="mt-1 font-sans text-caption" style={{ color: colors.muted }}>
          We'll tell you when your parcel is on its way and when it reaches your checkpoint.
        </Text>
        {error ? (
          <Text className="mt-1 font-sans text-caption" style={{ color: colors.muted }}>
            {error}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          <Pressable
            onPress={turnOn}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            style={{ backgroundColor: colors.lime, borderRadius: radii.pill, paddingVertical: 10, paddingHorizontal: 18, minHeight: 44, justifyContent: "center" }}
          >
            <Text className="font-sans-medium text-caption" style={{ color: colors.ink }}>
              {busy ? "Turning on…" : "Turn on"}
            </Text>
          </Pressable>
          <Pressable
            onPress={notNow}
            accessibilityRole="button"
            style={{ borderRadius: radii.pill, paddingVertical: 10, paddingHorizontal: 18, minHeight: 44, justifyContent: "center" }}
          >
            <Text className="font-sans-medium text-caption" style={{ color: colors.muted }}>
              Not now
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
