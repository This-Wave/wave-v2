import { Pressable, Text, View } from "react-native";
import { Illustration } from "../components/v7/Illustration";

/**
 * v7 canvas "This page took a wrong turn": the running illustration, one line,
 * one way home. Shown for any web path Wave does not serve.
 */
export function NotFoundScreen() {
  return (
    <View className="flex-1 bg-canvas px-gutter pb-8">
      <View className="w-full max-w-[420px] flex-1 items-center justify-center self-center" style={{ gap: 12 }}>
        <Illustration name="run" width={240} height={180} />
        <Text accessibilityRole="header" className="text-center font-display text-heading text-ink">
          This page took a wrong turn
        </Text>
        <Text className="text-center font-sans text-ui text-muted">The link may be old.</Text>
      </View>
      <Pressable
        onPress={() => {
          if (typeof window !== "undefined") window.location.replace("/");
        }}
        accessibilityRole="button"
        accessibilityLabel="Go home"
        className="min-h-[56px] w-full max-w-[420px] items-center justify-center self-center rounded-input border-b-4 border-lime-edge bg-lime"
      >
        <Text className="font-sans-bold text-ui uppercase tracking-wider text-on-lime">Go home</Text>
      </Pressable>
    </View>
  );
}
