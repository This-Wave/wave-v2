import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { ReactNode } from "react";
import { shadowCard } from "../../theme/tokens";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0h 0m";
  const totalMinutes = Math.floor(ms / 60000);
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

interface CountdownCardProps {
  dayLabel: string;
  cutoffAt: Date;
  /** Action pair rendered inside the green card (Buy For Me / Pickup on screen 04). */
  children?: ReactNode;
}

/**
 * v5 screen 04 hero: solid #009933 card, 24px radius, a lime bloom in the top-right
 * corner, an eyebrow, a 44px countdown, then the action row.
 */
export function CountdownCard({ dayLabel, cutoffAt, children }: CountdownCardProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View className="overflow-hidden rounded-card bg-wave-500 p-[22px]" style={shadowCard}>
      <View
        className="absolute h-[180px] w-[180px] rounded-full"
        style={{ backgroundColor: "rgba(176,232,146,0.1)", top: -80, right: -60 }}
      />
      <Text className="mb-1.5 font-sans-medium text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
        Next run · {dayLabel}
      </Text>
      <Text className="mb-[18px] font-sans-semibold text-[44px] leading-[44px] tracking-tighter text-white">
        {formatCountdown(cutoffAt.getTime() - now)}
      </Text>
      {children ? <View className="flex-row gap-2.5">{children}</View> : null}
    </View>
  );
}
