import { Pressable, Text, View } from "react-native";
import type { WaveInfo } from "../../lib/wave";
import { ChevronRightIcon, WaveMarkIcon } from "../icons";
import { colors } from "../../theme/tokens";

/**
 * The next Wave and how long is left to join it, as a strip on the canvas.
 *
 * This is the third home the countdown has had, and the reasoning for each move
 * is worth keeping. A card of its own put it in a stack of four cards of equal
 * weight before a student saw anything they had asked for. Folded into the ink
 * panel it stopped reading as a thing you could press, and it made the panel
 * carry three unrelated jobs. Here it is one row, below the panel, on the pale
 * accent wash — the reference's standing-information strip, which is exactly
 * what a twice-weekly schedule is.
 *
 * `lime-faint` and not `lime`: a full-accent block for information competes
 * with the action above it, and white on lime fails contrast outright, so the
 * accent could only ever be a wash here anyway. It is the one tinted ground on
 * Home, which is what makes it findable.
 *
 * The mark doubles as the strip's icon. It is the only decorative use of the
 * logo in the app, and it earns it by being the thing that says *Wave's*
 * schedule rather than the student's own orders.
 */
export function WaveStrip({ wave, onPress }: { wave: WaveInfo | null; onPress: () => void }) {
  const closed = !wave || wave.closed;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        closed
          ? "Today's Wave has closed. See the next one"
          : `${wave.name}, ${wave.countdown} left to order`
      }
      accessibilityHint="Opens the Wave calendar"
      className="flex-row items-center gap-3.5 rounded-card bg-lime-faint px-4 py-3.5 active:bg-lime/30"
    >
      <View className="overflow-hidden rounded-pill">
        <WaveMarkIcon size={36} />
      </View>

      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-ui text-ink" numberOfLines={1}>
          {closed ? "Today's Wave has closed" : wave.name}
        </Text>
        {/* `ink-700` rather than `muted`: the tokens define it for text on a
            tinted ground, where full ink is too heavy and grey goes muddy. */}
        <Text className="font-sans text-body text-ink-700" numberOfLines={1}>
          {closed ? "See the next one" : `${wave.countdown} left to order`}
        </Text>
      </View>

      {/* The one moment the solid accent is warranted: under six hours,
          "later" has stopped being a safe assumption. */}
      {!closed && wave.closingSoon ? (
        <View className="rounded-pill bg-lime px-2.5 py-1">
          <Text className="font-sans-medium text-meta text-ink">closing soon</Text>
        </View>
      ) : null}

      <ChevronRightIcon size={18} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}
