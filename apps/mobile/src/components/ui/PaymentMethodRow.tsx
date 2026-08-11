import type { ReactNode } from "react";
import { View } from "react-native";
import { SelectRow } from "./SelectRow";

interface PaymentMethodRowProps {
  label: string;
  subtitle?: string;
  icon: ReactNode;
  selected: boolean;
  onPress?: () => void;
  children?: ReactNode;
}

// v5 screen 15: card row, 40px canvas icon well, trailing checkbox.
export function PaymentMethodRow({ label, subtitle, icon, selected, onPress, children }: PaymentMethodRowProps) {
  return (
    <View>
      <SelectRow
        title={label}
        subtitle={subtitle}
        selected={selected}
        onPress={onPress}
        leading={
          <View className="h-10 w-10 items-center justify-center rounded-control bg-canvas">{icon}</View>
        }
      />
      {selected && children ? <View className="mt-2 px-4">{children}</View> : null}
    </View>
  );
}
