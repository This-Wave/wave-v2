import { Text, View } from "react-native";

interface FeeBreakdownRowProps {
  label: string;
  value: string;
  isTotal?: boolean;
  isDiscount?: boolean;
}

export function FeeBreakdownRow({ label, value, isTotal, isDiscount }: FeeBreakdownRowProps) {
  return (
    <View
      className={`flex-row items-center justify-between ${isTotal ? "mt-2.5 border-t border-border pt-2.5" : "py-1"}`}
    >
      <Text className={`text-[13px] ${isTotal ? "font-sans-bold text-ink" : "text-text-secondary"}`}>{label}</Text>
      <Text
        className={`${isTotal ? "font-sans-extrabold text-[14px] text-ink" : "font-sans-semibold text-[13px]"} ${
          isDiscount ? "text-wave-500" : isTotal ? "" : "text-ink"
        }`}
      >
        {value}
      </Text>
    </View>
  );
}
