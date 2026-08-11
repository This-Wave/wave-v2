import { Pressable, Text, View } from "react-native";
import type { WaveInfo } from "../../lib/wave";
import { ProgressRail } from "./Progress";

/**
 * The next Wave and how long is left to join it.
 *
 * v5 gave this a 47-hour countdown in 40px numerals occupying a third of the
 * screen, which read as an emergency for what is a twice-weekly schedule. It is
 * back because the deadline is real and students need to feel it — but sized as
 * information, not alarm: the Wave's name leads, the countdown is a single line
 * beside it, and the rail carries the urgency visually.
 *
 * Under six hours the treatment flips to the lime ground. That is the one point
 * where "I'll do it later" stops being safe, so it is the one point that earns
 * the accent.
 */
export function WaveBanner({ wave, onPress }: { wave: WaveInfo; onPress?: () => void }) {
  const urgent = wave.closingSoon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${wave.name}, ordering closes in ${wave.countdown}`}
      className={`rounded-card p-4 ${urgent ? "bg-lime" : "bg-surface"}`}
    >
      <View className="mb-3 flex-row items-end justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
            {wave.name}
          </Text>
          <Text
            className={`font-sans text-body ${urgent ? "text-ink" : "text-muted"}`}
            numberOfLines={1}
          >
            Arriving {wave.dateLabel}
          </Text>
        </View>

        <View className="items-end">
          <Text className="font-sans-bold text-heading-sm text-ink">{wave.countdown}</Text>
          <Text className={`font-sans text-meta ${urgent ? "text-ink" : "text-muted"}`}>
            {urgent ? "closing soon" : "to order"}
          </Text>
        </View>
      </View>

      {urgent ? (
        <View className="h-0.5 w-full overflow-hidden rounded-pill bg-ink/20">
          <View className="h-full rounded-pill bg-ink" style={{ width: `${wave.elapsed * 100}%` }} />
        </View>
      ) : (
        <ProgressRail ratio={wave.elapsed} />
      )}
    </Pressable>
  );
}

/** Shown once the cutoff has passed and the next Wave has not opened. */
export function WaveClosedBanner({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-card bg-surface p-4">
      <Text className="font-sans-medium text-body text-ink">Today's Wave has closed</Text>
      <Text className="font-sans text-body text-muted">
        Orders lock at noon. Tap to see the next one.
      </Text>
    </Pressable>
  );
}
