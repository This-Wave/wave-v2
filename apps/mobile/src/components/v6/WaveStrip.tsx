import { Pressable, Text, View } from "react-native";
import type { WaveInfo } from "../../lib/wave";

/**
 * The next Wave, how long is left to join it, and the way to pick another day.
 *
 * Two rows on one card. The top row pairs the mark and the Wave's name on the
 * left with the time remaining on the right, because those are two different
 * facts and stacking the time under the name made it read as a subtitle — a
 * detail about the Wave rather than the number the card exists to deliver.
 * Under a hairline, the last row says what tapping does.
 *
 * That last row is here because the card it replaced was pressable with nothing
 * saying so, which is how the calendar became undiscoverable: students could
 * not change the delivery day because they never learned the countdown was a
 * control. It names the outcome ("a different day") rather than the concept
 * ("Waves"), since the day is what a student is actually choosing.
 *
 * `lime-faint` and not `lime`: a full-accent block for information competes
 * with the actions above it, and white on lime fails contrast outright, so the
 * accent could only ever be a wash here. It is the one tinted ground on Home,
 * which is what makes it findable.
 */
export function WaveStrip({ wave, onPress }: { wave: WaveInfo | null; onPress: () => void }) {
  const closed = !wave || wave.closed;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        closed
          ? "Today's Wave has closed. Tap to choose a different day"
          : `${wave.name}, ${wave.countdown} left to order. Tap to choose a different day`
      }
      accessibilityHint="Opens the Wave calendar"
      className="rounded-card border border-hairline bg-surface px-4 py-3.5 active:bg-canvas"
    >
      {/* v7 canvas: the Wave's name, the noon rule, and the countdown as the
          card's one figure. */}
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-ui text-ink" numberOfLines={1}>
            {closed ? "Today's Wave has left" : wave.name}
          </Text>
          <Text className="font-sans text-body text-muted" numberOfLines={1}>
            {closed ? "Pick the next day" : "Order by 12 noon"}
          </Text>
        </View>
        {closed ? null : (
          <Text className="font-display text-heading-sm text-ink">{wave.countdown}</Text>
        )}
      </View>
    </Pressable>
  );
}
