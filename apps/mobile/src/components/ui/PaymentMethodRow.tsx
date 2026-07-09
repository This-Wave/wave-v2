import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";

interface PaymentMethodRowProps {
  label: string;
  logoBgClass: string;
  logoLabel: string;
  selected: boolean;
  onPress?: () => void;
  children?: ReactNode;
}

export function PaymentMethodRow({ label, logoBgClass, logoLabel, selected, onPress, children }: PaymentMethodRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-control p-3.5 ${selected ? "border-[1.5px] border-wave-500" : "border border-border"}`}
    >
      <View className="flex-row items-center">
        <View className={`mr-3 h-9 w-9 items-center justify-center rounded-chip ${logoBgClass}`}>
          <Text className="font-sans-extrabold text-[10px] text-white">{logoLabel}</Text>
        </View>
        <Text className="flex-1 font-sans-extrabold text-[16px] text-ink">{label}</Text>
        <View
          className={`h-5 w-5 items-center justify-center rounded-full ${
            selected ? "bg-wave-500" : "border border-border"
          }`}
        >
          {selected ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
        </View>
      </View>
      {selected && children ? <View className="mt-3">{children}</View> : null}
    </Pressable>
  );
}
