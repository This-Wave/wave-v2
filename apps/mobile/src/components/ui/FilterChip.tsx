import { Pressable, Text } from "react-native";

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress?: () => void;
}

export function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-pill px-3.5 py-2 ${active ? "bg-ink" : "border border-border bg-surface"}`}
    >
      <Text className={`font-sans-semibold text-[12px] ${active ? "text-white" : "text-text-tertiary"}`}>{label}</Text>
    </Pressable>
  );
}
