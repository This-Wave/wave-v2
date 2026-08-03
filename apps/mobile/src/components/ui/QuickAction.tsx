import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

interface QuickActionProps {
  label: string;
  icon: ReactNode;
  onPress?: () => void;
}

// v5 screen 04: 52x52 white tile, 18px radius, 11px label beneath.
export function QuickAction({ label, icon, onPress }: QuickActionProps) {
  return (
    <Pressable onPress={onPress} className="items-center gap-2">
      <View className="h-[52px] w-[52px] items-center justify-center rounded-control border border-border bg-surface">
        {icon}
      </View>
      <Text className="font-sans-medium text-[11px] text-ink">{label}</Text>
    </Pressable>
  );
}
