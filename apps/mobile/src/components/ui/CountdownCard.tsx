import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { CalendarClock } from "lucide-react-native";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0h 0m 0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

interface CountdownCardProps {
  dayLabel: string;
  cutoffAt: Date;
  closesAtLabel: string;
}

export function CountdownCard({ dayLabel, cutoffAt, closesAtLabel }: CountdownCardProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View className="rounded-card border border-border bg-surface p-3.5">
      <View className="mb-1.5 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <CalendarClock size={14} color="#2EA64E" />
          <Text className="font-sans-semibold text-[11px] uppercase tracking-wide text-text-secondary">Next Run</Text>
        </View>
        <Text className="font-sans-bold text-[12px] text-ink">{dayLabel}</Text>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] text-muted">{closesAtLabel}</Text>
        <Text className="font-sans-extrabold text-[16px] text-wave-500" style={{ fontVariant: ["tabular-nums"] }}>
          {formatCountdown(cutoffAt.getTime() - now)}
        </Text>
      </View>
    </View>
  );
}
