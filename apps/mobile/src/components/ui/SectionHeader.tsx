import { Pressable, Text, View } from "react-native";

interface SectionHeaderProps {
  label: string;
  eyebrow?: boolean;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ label, eyebrow, actionLabel, onActionPress }: SectionHeaderProps) {
  if (eyebrow) {
    return <Text className="mb-2.5 font-sans-bold text-[10px] uppercase tracking-wider text-muted">{label}</Text>;
  }
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="font-sans-bold text-[13px] text-ink">{label}</Text>
      {actionLabel ? (
        <Pressable onPress={onActionPress}>
          <Text className="font-sans-semibold text-[11px] text-wave-500">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
