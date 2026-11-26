import { Text, View } from "react-native";
import { WaveMarkIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";

/** v7 canvas splash: the mark and wordmark on Sacramento, nothing else. */
export function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.ink }}>
      <View className="flex-row items-center" style={{ gap: 10 }} accessible accessibilityLabel="Wave">
        <WaveMarkIcon size={64} inverse />
        <Text className="font-sans-bold" style={{ fontSize: 44, lineHeight: 48, letterSpacing: -1.5, color: "#fdfcf8" }}>
          wave
        </Text>
      </View>
    </View>
  );
}
