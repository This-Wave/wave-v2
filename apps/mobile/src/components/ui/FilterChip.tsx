import { Pressable, Text } from "react-native";

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress?: () => void;
}

// v5 screen 12: solid green when active, white + hairline otherwise.
export function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-pill px-3.5 py-1.5 ${active ? "bg-wave-500" : "border border-border bg-surface"}`}
    >
      <Text className={`font-sans-semibold text-[12px] ${active ? "text-white" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}
