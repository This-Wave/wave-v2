import { Pressable, Text, View } from "react-native";

interface SectionHeaderProps {
  label: string;
  /** 12px uppercase muted eyebrow (screens 05/14); otherwise an 18px section title. */
  eyebrow?: boolean;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ label, eyebrow, actionLabel, onActionPress }: SectionHeaderProps) {
  if (eyebrow) {
    return (
      <Text className="mb-3 font-sans-semibold text-[12px] uppercase tracking-[0.6px] text-muted">{label}</Text>
    );
  }
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="font-sans-semibold text-[18px] text-ink">{label}</Text>
      {actionLabel ? (
        <Pressable onPress={onActionPress}>
          <Text className="font-sans-semibold text-[13px] text-wave-500">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
