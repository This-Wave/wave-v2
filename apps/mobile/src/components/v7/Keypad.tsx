import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../../theme/tokens";

/**
 * v7 canvas number pad (rider handover): sticker keys, 1-9, 0, delete. Used in
 * place of the phone keyboard so the code entry is the same on every device
 * and the keys are big enough to hit while holding a parcel.
 */
export function Keypad({ onDigit, onDelete }: { onDigit: (d: string) => void; onDelete: () => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
  return (
    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
      {keys.map((k, i) => (
        <View key={i} style={{ width: "31%", flexGrow: 1 }}>
          {k === "" ? (
            <View className="h-16 rounded-input border-2 border-hairline" />
          ) : (
            <Pressable
              onPress={() => (k === "del" ? onDelete() : onDigit(k))}
              accessibilityRole="button"
              accessibilityLabel={k === "del" ? "Delete" : k}
              className="h-16 items-center justify-center rounded-input border-2 border-b-4 border-line bg-surface active:translate-y-0.5 active:border-b-2"
            >
              {k === "del" ? (
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 5h11v14H9l-6-7 6-7Z" stroke={colors.ink} strokeWidth={2} strokeLinejoin="round" />
                  <Path d="M12.5 9.5l5 5m0-5l-5 5" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              ) : (
                <Text className="font-display text-heading text-ink">{k}</Text>
              )}
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}
