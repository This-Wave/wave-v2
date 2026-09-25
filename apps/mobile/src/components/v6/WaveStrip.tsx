import { Pressable, Text, View } from "react-native";
import type { WaveInfo } from "../../lib/wave";
import { WaveMarkIcon } from "../icons";

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
      className="rounded-card bg-lime-faint px-4 py-3.5 active:bg-lime/30"
    >
      <View className="flex-row items-center gap-3.5">
        <View className="overflow-hidden rounded-pill">
          <WaveMarkIcon size={36} />
        </View>

        <View className="min-w-0 flex-1 pr-2">
          <Text className="font-sans-medium text-ui text-ink" numberOfLines={1}>
            {closed ? "Today's Wave has closed" : wave.name}
          </Text>
          {/* The arrival date, not the countdown: the time moved to the right
              of the card, and leaving its caption behind on the left read as a
              dangling phrase ("Sunday's Wave / left to order").
              `ink-700` rather than `muted` — the tokens define it for text on a
              tinted ground, where full ink is too heavy and grey goes muddy. */}
          <Text className="font-sans text-body text-ink-700" numberOfLines={1}>
            {closed ? "Pick the next one" : `Arriving ${wave.dateLabel}`}
          </Text>
        </View>

        {/* The time, as the card's figure. Right-aligned against the name so
            the two read as a pair rather than a sentence. */}
        {closed ? null : (
          <View className="items-end">
            <Text className="font-sans-bold text-heading-sm text-ink">{wave.countdown}</Text>
            <Text className="font-sans text-meta text-ink-700">left to order</Text>
            {/* The one moment the solid accent is warranted here: under six
                hours, "later" has stopped being a safe assumption. */}
            {wave.closingSoon ? (
              <View className="mt-1 rounded-pill bg-lime px-2 py-0.5">
                <Text className="font-sans-medium text-meta text-on-accent">closing soon</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* `border-ink/10` rather than `hairline`: the neutral divider is tuned
          for white cards and disappears on the tinted ground. */}
      <View className="mt-3 border-t border-ink/10 pt-2.5">
        <Text className="font-sans text-meta text-ink-700">Tap to choose a different day</Text>
      </View>
    </Pressable>
  );
}
