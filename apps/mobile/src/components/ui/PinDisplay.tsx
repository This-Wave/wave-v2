import { Text, View } from "react-native";

interface PinDisplayProps {
  pin: string;
  /** One cell flips to solid green with a lime numeral (screen 11). */
  highlightIndex?: number;
}

// v5 screen 11: six 44x58 cells, 18px radius, 26px semibold numerals.
export function PinDisplay({ pin, highlightIndex = 3 }: PinDisplayProps) {
  const digits = Array.from({ length: 6 }, (_, i) => pin[i] ?? "");
  return (
    <View className="flex-row gap-2.5">
      {digits.map((digit, index) => {
        const highlighted = index === highlightIndex;
        return (
          <View
            key={index}
            className={`h-[58px] w-[44px] items-center justify-center rounded-control ${
              highlighted ? "bg-wave-500" : "border border-border bg-surface"
            }`}
          >
            <Text className={`font-sans-semibold text-[26px] ${highlighted ? "text-wave-lime" : "text-ink"}`}>
              {digit}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const BAR_WIDTHS = [2, 1, 3, 1, 2, 1, 2, 3, 1, 2, 1, 2, 2, 1, 3, 1, 2, 1];

/** The decorative barcode block beneath the PIN on screen 11. */
export function Barcode({ label }: { label: string }) {
  return (
    <View className="w-full items-center rounded-card border border-border bg-surface p-4">
      <View className="mb-2.5 flex-row gap-[2px]">
        {BAR_WIDTHS.map((width, index) => (
          <View key={index} className="h-9 bg-ink" style={{ width }} />
        ))}
      </View>
      <Text className="text-[12px] text-muted">{label}</Text>
    </View>
  );
}
