import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "../theme/tokens";
import { useAuthStore } from "../store/authStore";
import {
  detectInstallPlatform,
  hasDeferredPrompt,
  hasDismissedInstallHint,
  isStandalone,
  markInstallHintDismissed,
  showInstallPrompt,
  type InstallPlatform,
} from "../lib/installPrompt";

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
    if (isStandalone()) return;

    let cancelled = false;
    const detected = detectInstallPlatform(window.navigator.userAgent);
    if (detected === "none") return;

    // Android only earns the hint once the browser has actually offered an
    // install — otherwise the button would have nothing to open. iOS has no
    // such signal, so the instruction stands on its own.
    //
    // Delayed rather than immediate: `beforeinstallprompt` lands shortly after
    // load, and a card that appears the instant a screen paints reads as an ad.
    const timer = setTimeout(() => {
      void (async () => {
        if (await hasDismissedInstallHint()) return;
        if (cancelled) return;
        if (detected === "android" && !hasDeferredPrompt()) return;
        setPlatform(detected);
        setVisible(true);
      })();
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
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
        bottom: insets.bottom + 16,
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
          Add Wave to your home screen
        </Text>
        <Text className="mt-1 font-sans text-caption" style={{ color: colors.muted }}>
          {platform === "ios"
            ? "Tap the Share button in Safari, then choose Add to Home Screen. Wave opens full screen, like an app."
            : "Wave opens full screen and loads faster, and you won't have to find this page again."}
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
              {platform === "ios" ? "Got it" : "Not now"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
