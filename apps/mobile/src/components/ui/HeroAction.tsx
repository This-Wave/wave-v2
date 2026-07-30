import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

interface HeroActionProps {
  label: string;
  icon: ReactNode;
  /** Lime fill (primary) vs. translucent outline (secondary) — screen 04. */
  primary?: boolean;
  onPress?: () => void;
}

export function HeroAction({ label, icon, primary, onPress }: HeroActionProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-control ${
        primary ? "bg-wave-lime" : "border"
      }`}
      style={primary ? undefined : { borderColor: "rgba(255,255,255,0.3)" }}
    >
      <View>{icon}</View>
      <Text className={`font-sans-semibold text-[14px] ${primary ? "text-wave-500" : "text-white"}`}>{label}</Text>
    </Pressable>
  );
}
