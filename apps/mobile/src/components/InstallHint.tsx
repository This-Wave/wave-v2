import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FULL, NAV_BOTTOM_GAP } from "./v6/TabBar";
import { colors, radii } from "../theme/tokens";
import { useAuthStore } from "../store/authStore";
import {
  detectInstallPlatform,
  hasDismissedInstallHint,
  isStandalone,
  markInstallHintDismissed,
  onInstallPromptAvailable,
  showInstallPrompt,
  type InstallPlatform,
} from "../lib/installPrompt";
import { reportAppInstalled } from "../lib/growth";
import { hasAcceptedCookies, onCookiesAccepted } from "./CookieConsent";

/**
 * "Put Wave on your home screen."
 *
 * Wave's pilot is a web app, so this is the install flow — there is no store
 * listing doing this job. It is deliberately shown only to a signed-in account:
 * asking a first-time visitor to install something they have not used yet is
 * noise, and the students who benefit are the ones coming back for the next
 * Wave day.
 *
 * Android gets a real button, because `beforeinstallprompt` gives us one. iOS
 * gets a sentence describing the Share-sheet gesture, because Apple provides no
 * API and never has. Dismissing is permanent, per device.
 */
export function InstallHint() {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const [platform, setPlatform] = useState<InstallPlatform>("none");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (!profile) return;
    // Opened from the home-screen icon: tell the API once, for the owner's
    // installs list, and there is nothing to suggest.
    if (isStandalone()) {
      reportAppInstalled();
      return;
    }

    let cancelled = false;
    const detected = detectInstallPlatform(window.navigator.userAgent);
    if (detected === "none") return;

    // Delayed rather than immediate: a card that appears the instant a screen
    // paints reads as an ad.
    let stopWaitingForCookies = () => {};
    const reveal = async () => {
      if (cancelled) return;
      // Never on top of the cookie notice: wait until it has been accepted.
      if (!hasAcceptedCookies()) {
        stopWaitingForCookies = onCookiesAccepted(() => {
          timer = setTimeout(() => void reveal(), 1500);
        });
        return;
      }
      if (await hasDismissedInstallHint()) return;
      if (cancelled) return;
      setPlatform(detected);
      setVisible(true);
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};

    if (detected === "android") {
      // Android earns the hint only once the browser has actually offered an
      // install, or the button would have nothing to open. That offer is
      // *subscribed* to rather than sampled: Chrome fires it only after the
      // service worker registers, which is itself deferred to `load`, so on a
      // slow connection it can land long after any fixed delay.
      unsubscribe = onInstallPromptAvailable(() => {
        timer = setTimeout(() => void reveal(), 4000);
      });
    } else {
      // iOS has no such signal — the instruction stands on its own.
      timer = setTimeout(() => void reveal(), 4000);
    }

    return () => {
      cancelled = true;
      unsubscribe();
      stopWaitingForCookies();
      if (timer) clearTimeout(timer);
    };
  }, [profile]);

  const dismiss = useCallback(() => {
    setVisible(false);
    void markInstallHintDismissed();
  }, []);

  const install = useCallback(() => {
    void (async () => {
      await showInstallPrompt();
      // Dismissed either way: if they accepted, the hint is done; if they
      // declined the browser's own dialog, asking again is nagging.
      setVisible(false);
      void markInstallHintDismissed();
    })();
  }, []);

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        // Clears the floating nav pill rather than sitting on top of it. This
        // card appears on a delay, so before this it slid over the tab bar
        // mid-task: the student reached for Orders, nothing happened, and there
        // was no reason to connect the two events. Finding G.
        bottom: Math.max(insets.bottom, NAV_BOTTOM_GAP) + FULL + 12,
        zIndex: 9998,
        alignItems: "center",
      }}
    >
      <View
        accessibilityRole={Platform.OS === "web" ? undefined : "alert"}
        style={{
          width: "100%",
          maxWidth: 480,
          backgroundColor: colors.surface,
          borderRadius: radii.card,
          padding: 16,
          ...(Platform.OS === "web"
            ? ({ boxShadow: "0 4px 20px rgba(8,52,0,0.12)" } as object)
            : {}),
        }}
      >
        <Text className="font-sans-bold text-body" style={{ color: colors.ink }}>
          Get delivery updates on your phone
        </Text>
        <Text className="mt-1 font-sans text-caption" style={{ color: colors.muted }}>
          {platform === "ios"
            ? "Add Wave to your Home Screen: tap Share in Safari, then Add to Home Screen. Open it from there and turn on notifications, and we'll tell you when your parcel reaches your checkpoint."
            : "Install Wave and turn on notifications. We'll tell you the moment your parcel reaches your checkpoint."}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {platform === "android" ? (
            <Pressable
              onPress={install}
              accessibilityRole="button"
              accessibilityLabel="Install Wave"
              style={{
                backgroundColor: colors.lime,
                borderRadius: radii.pill,
                paddingVertical: 10,
                paddingHorizontal: 18,
              }}
            >
              <Text className="font-sans-medium text-caption" style={{ color: colors.ink }}>
                Install
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss the install suggestion"
            style={{
              borderRadius: radii.pill,
              paddingVertical: 10,
              paddingHorizontal: 18,
            }}
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
