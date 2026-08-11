import { Pressable, Text } from "react-native";

interface DaySelectorCardProps {
  dayLabel: string;
  dateLabel: string;
  tag?: string;
  selected: boolean;
  surcharge?: boolean;
  onPress?: () => void;
}

/**
 * v5 screen 07 day chip: 18px radius, solid green when selected, otherwise white
 * with a hairline border. Weekday sits above the date numeral.
 */
export function DaySelectorCard({ dayLabel, dateLabel, tag, selected, surcharge, onPress }: DaySelectorCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-control py-2.5 ${
        selected ? "bg-wave-500" : "border border-border bg-surface"
      }`}
    >
      <Text
        className="mb-1 text-[10px]"
        style={selected ? { color: "rgba(255,255,255,0.7)" } : { color: "#6B7D63" }}
      >
        {dayLabel}
      </Text>
      <Text className={`font-sans-semibold text-[15px] ${selected ? "text-white" : "text-ink"}`}>{dateLabel}</Text>
      {tag ? (
        <Text
          className={`mt-1 text-[9px] font-sans-semibold ${
            selected ? "text-wave-lime" : surcharge ? "text-warning-text" : "text-muted"
          }`}
        >
          {tag}
        </Text>
      ) : null}
    </Pressable>
  );
}
