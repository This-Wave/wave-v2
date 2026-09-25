import { Pressable, Text, View } from "react-native";
import { WaveMarkIcon } from "../components/icons";

/**
 * The web app's 404.
 *
 * `apps/mobile/vercel.json` rewrites every path to `index.html`, which is what
 * makes a single-page app work at all — but it also meant a typo'd or stale URL
 * loaded the app and landed silently on Home. Nothing was broken and nothing
 * said so, which is worse than an error: a student following a bad link had no
 * way to know the link was bad.
 *
 * `/` is the only path the app serves. Deep links are not URL-based here —
 * there is no `linking` config on the NavigationContainer — and the Paystack
 * return comes back to the origin with query parameters rather than a path
 * (`consumePaymentReturn` reads `?reference=`), so it is unaffected. Static
 * files like `/legal/terms.html` are served by Vercel before the rewrite and
 * never reach this code.
 *
 * Rendered outside the NavigationContainer, so it needs no route and works
 * before sign-in — a 404 that demanded a login would be a second dead end.
 */
export function NotFoundScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-gutter">
      <View className="w-full max-w-[420px] items-center">
        <View className="mb-6 overflow-hidden rounded-card">
          <WaveMarkIcon size={56} />
        </View>

        <Text className="text-center font-sans-bold text-heading text-ink">
          This page doesn&apos;t exist
        </Text>
        <Text className="mt-2 text-center font-sans text-body text-muted">
          The link may be old, or mistyped. Wave itself is fine — nothing has gone wrong with your
          orders.
        </Text>

        <Pressable
          onPress={() => {
            // A full navigation, not a router push: this screen deliberately
            // sits outside the navigator, so there is nothing to push onto.
            if (typeof window !== "undefined") window.location.replace("/");
          }}
          accessibilityRole="button"
          accessibilityLabel="Go to Wave"
          className="mt-7 min-h-[48px] justify-center rounded-pill bg-lime px-6 active:bg-lime-600"
        >
          <Text className="font-sans-semibold text-ui text-on-accent">Go to Wave</Text>
        </Pressable>
      </View>
    </View>
  );
}
