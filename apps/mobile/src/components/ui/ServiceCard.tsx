import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "../icons";

interface ServiceCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onPress?: () => void;
}

// v5 card idiom: white, hairline border, 24px radius, 14px icon tile.
export function ServiceCard({ icon, title, description, actionLabel, onPress }: ServiceCardProps) {
  return (
    <Pressable onPress={onPress} className="flex-1 rounded-card border border-border bg-surface p-4">
      <View className="mb-3 h-[42px] w-[42px] items-center justify-center rounded-tile bg-canvas">{icon}</View>
      <Text className="mb-1 font-sans-semibold text-[15px] text-ink">{title}</Text>
      <Text className="text-[12px] leading-[18px] text-muted">{description}</Text>
      <View className="mt-3 flex-row items-center gap-1.5">
        <Text className="font-sans-semibold text-[12px] text-wave-500">{actionLabel}</Text>
        <ChevronRightIcon size={10} />
      </View>
    </Pressable>
  );
}
