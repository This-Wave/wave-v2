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
          // v7 canvas: a white card with an edge, a lime Accept key.
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: radii.card,
          padding: 16,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text className="flex-1 font-sans text-meta text-ink-700">
          Wave uses cookies to keep you signed in and remember your basket.
          {PRIVACY_URL ? (
            <Text
              accessibilityRole="link"
              onPress={() => void Linking.openURL(PRIVACY_URL)}
              className="font-sans-bold text-link"
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
          className="min-h-[44px] justify-center rounded-input border-b-4 border-lime-edge bg-lime px-4"
        >
          <Text className="font-sans-bold text-meta uppercase tracking-wider text-on-lime">Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}
