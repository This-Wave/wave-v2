import { Pressable, Text, View } from "react-native";

interface DaySelectorCardProps {
  dayLabel: string;
  dateLabel: string;
  tag: string;
  selected: boolean;
  surcharge?: boolean;
  onPress?: () => void;
}

export function DaySelectorCard({ dayLabel, dateLabel, tag, selected, surcharge, onPress }: DaySelectorCardProps) {
  const borderClass = selected ? "border-[1.5px] border-wave-500 bg-success-bg-faint" : "border border-border bg-surface";
  return (
    <Pressable onPress={onPress} className={`flex-1 items-center rounded-well p-2.5 ${borderClass}`}>
      <Text className="font-sans-bold text-[12px] text-ink">{dayLabel}</Text>
      <Text className="mt-0.5 text-[10px] text-muted">{dateLabel}</Text>
      <View className={`mt-1.5 rounded-pill px-2 py-0.5 ${surcharge ? "bg-warning-bg" : "bg-surface-muted"}`}>
        <Text className={`text-[9px] font-sans-semibold ${surcharge ? "text-warning-text" : "text-text-secondary"}`}>
          {tag}
        </Text>
      </View>
    </Pressable>
  );
}
