import { Text, View } from "react-native";

interface FeeBreakdownRowProps {
  label: string;
  value: string;
  isTotal?: boolean;
  isDiscount?: boolean;
}

// v5 screens 06/13: 14px muted label, semibold ink value; the total sits below a
// hairline rule with a 26px green figure.
export function FeeBreakdownRow({ label, value, isTotal, isDiscount }: FeeBreakdownRowProps) {
  if (isTotal) {
    return (
      <View>
        <View className="mb-4 mt-1 h-px bg-border" />
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-semibold text-[18px] text-ink">{label}</Text>
          <Text className="font-sans-semibold text-[26px] tracking-tighter text-wave-500">{value}</Text>
        </View>
      </View>
    );
  }
  return (
    <View className="mb-2.5 flex-row items-center justify-between">
      <Text className="text-[14px] text-muted">{label}</Text>
      <Text className={`font-sans-semibold text-[14px] ${isDiscount ? "text-wave-500" : "text-ink"}`}>{value}</Text>
    </View>
  );
}
