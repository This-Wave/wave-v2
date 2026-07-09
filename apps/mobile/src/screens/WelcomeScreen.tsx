import { SafeAreaView, Text, View } from "react-native";

export function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white">
      <View className="items-center gap-2 px-6">
        <Text className="text-2xl font-semibold text-wave-700">Wave</Text>
        <Text className="text-center text-sm text-neutral-500">
          Campus delivery for Ashesi University — scaffold ready for Phase 1 auth screens.
        </Text>
      </View>
    </SafeAreaView>
  );
}
