import { Text, View } from "react-native";

/**
 * Rendered while the auth session hydrates.
 *
 * v5 filled the screen with brand green. v6 has no such surface — ink is a text
 * colour and lime is fill-only — so the splash is the canvas with the wordmark,
 * which is also what the app looks like a frame later. Nothing flashes.
 */
export function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <View className="flex-row items-center gap-2.5">
        <View className="h-10 w-10 items-center justify-center rounded-pill bg-lime">
          <Text className="font-sans-bold text-subheading text-ink">W</Text>
        </View>
        <Text className="font-sans-bold text-ink" style={{ fontSize: 34, lineHeight: 38 }}>
          wave
        </Text>
      </View>
      <Text className="mt-3 font-sans text-body text-muted">Campus delivery, on schedule.</Text>
    </View>
  );
}
