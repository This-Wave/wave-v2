import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "../theme/tokens";

const KEY = "wave.cookiesAccepted";
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

/** True once this browser has accepted. Storage blocked counts as not yet. */
export function hasAcceptedCookies(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();
/** For things that wait for the banner to go (the install popup). */
export function onCookiesAccepted(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Cookie notice for every visitor of the web app, signed in or not.
 *
 * Wave stores only what it needs to work (the sign-in session, the basket,
 * preferences) in cookies and local storage, so this is a notice with one
 * button rather than a menu of categories. It stays until accepted.
 */
export function CookieConsent() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    setVisible(!hasAcceptedCookies());
  }, []);

  function accept() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* private mode: the banner returns next visit, which is honest */
    }
    setVisible(false);
    listeners.forEach((fn) => fn());
  }

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      // Top of the screen: at the bottom it covered Welcome's two buttons and
      // the tab bar, the things a first-time visitor is about to tap.
      style={{ position: "absolute", left: 16, right: 16, top: Math.max(insets.top, 12), zIndex: 9999, alignItems: "center" }}
    >
      <View
        accessibilityRole={Platform.OS === "web" ? ("region" as never) : undefined}
        accessibilityLabel="Cookie notice"
        style={{
          width: "100%",
          maxWidth: 480,
          backgroundColor: colors.ink,
          borderRadius: radii.card,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text className="flex-1 font-sans text-caption" style={{ color: colors.white }}>
          Wave uses cookies to keep you signed in and remember your basket.
          {PRIVACY_URL ? (
            <Text
              accessibilityRole="link"
              onPress={() => void Linking.openURL(PRIVACY_URL)}
              style={{ textDecorationLine: "underline" }}
            >
              {" "}
              Privacy
            </Text>
          ) : null}
        </Text>
        <Pressable
          onPress={accept}
          accessibilityRole="button"
          accessibilityLabel="Accept cookies"
          style={{ backgroundColor: colors.lime, borderRadius: radii.pill, paddingVertical: 10, paddingHorizontal: 18, minHeight: 44, justifyContent: "center" }}
        >
          <Text className="font-sans-medium text-caption" style={{ color: colors.ink }}>
            Accept
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
