import { Pressable, Text, View } from "react-native";
import type { WaveInfo } from "../../lib/wave";
import { CalendarIcon, ChevronRightIcon } from "../icons";
import { colors } from "../../theme/tokens";

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
      // Sticker-key edge like the app's buttons, so the whole card reads as
      // something to press.
      className="rounded-card border-2 border-b-4 border-line bg-surface px-4 py-3 active:translate-y-0.5 active:border-b-2"
    >
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View className="h-11 w-11 items-center justify-center rounded-pill bg-wash">
          <CalendarIcon size={20} color={colors.ink} strokeWidth={1.9} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-ui text-ink" numberOfLines={1}>
            {closed ? "Today's Wave has left" : wave.name}
          </Text>
          <Text className="font-sans text-body text-muted" numberOfLines={1}>
            {closed ? "Pick the next day" : `${wave.countdown} left to order`}
          </Text>
        </View>
        {/* The control, named: it says what tapping does. */}
        <View className="flex-row items-center rounded-input bg-wash px-3 py-2" style={{ gap: 4 }}>
          <Text className="font-sans-bold text-meta text-ink">Change day</Text>
          <ChevronRightIcon size={14} color={colors.ink} strokeWidth={2.4} />
        </View>
      </View>
    </Pressable>
  );
}
