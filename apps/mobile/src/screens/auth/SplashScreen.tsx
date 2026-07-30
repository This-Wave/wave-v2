import { Text, View } from "react-native";
import { TruckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";

/**
 * v5 screen 01. Full-bleed #009933 field with a lime bloom off the top-right,
 * a 92px lime logo tile, and the wordmark in lime over a translucent tagline.
 * Rendered while the auth session hydrates.
 */
export function SplashScreen() {
  return (
    <View className="flex-1 items-center justify-center overflow-hidden bg-wave-500">
      <View
        className="absolute h-[340px] w-[340px] rounded-full"
        style={{ backgroundColor: "rgba(176,232,146,0.08)", top: -120, right: -100 }}
      />
      <View className="mb-6 h-[92px] w-[92px] items-center justify-center rounded-card bg-wave-lime">
        <TruckIcon size={42} color={colors.primary} />
      </View>
      <Text className="font-sans-extrabold text-[42px] tracking-tighter text-wave-lime">Wave</Text>
      <Text className="mt-2 font-sans-medium text-[15px]" style={{ color: "rgba(255,255,255,0.65)" }}>
        Campus delivery, quietly done.
      </Text>
    </View>
  );
}
