import { Pressable, Text, View } from "react-native";
import type { WaveInfo } from "../../lib/wave";
import { countdownParts } from "../../lib/wave";
import { ChevronRightIcon } from "../icons";
import { colors } from "../../theme/tokens";

/**
 * The next Wave as one line inside the greeting panel.
 *
 * Home used to give this a card of its own, stacked with the payment card, the
 * deliveries list and the routes — four cards of equal weight before a student
 * saw anything they had asked for. As a line in the panel it is context for the
 * action right below it, and the full counter lives one tap away on the Wave
 * screen, which is where someone who cares about the deadline is going anyway.
 *
 * `bg-white/10` matches the avatar and bell buttons in the same panel, so it
 * reads as a control rather than a caption. The card it replaced was pressable
 * with nothing to say so, which is how the calendar became undiscoverable.
 */
export function WaveNote({ wave, onPress }: { wave: WaveInfo | null; onPress: () => void }) {
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
      className="flex-row items-center rounded-input bg-white/10 px-3.5 py-3 active:bg-white/15"
    >
      <View className="min-w-0 flex-1 pr-2">
        <Text className="font-sans-medium text-body text-white" numberOfLines={1}>
          {closed ? "Today's Wave has closed" : wave.name}
        </Text>
        <Text className="font-sans text-meta text-white/70" numberOfLines={1}>
          {closed ? "See the next one" : `${wave.countdown} left to order`}
        </Text>
      </View>

      {!closed && wave.closingSoon ? (
        <View className="mr-2 rounded-pill bg-lime px-2 py-0.5">
          <Text className="font-sans-medium text-meta text-ink">closing soon</Text>
        </View>
      ) : null}

      <ChevronRightIcon size={18} color={colors.white} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * How long is left to join the next Wave, as a counter.
 *
 * This replaces the banner that used to sit on Home, and it is a counter rather
 * than a line of text because that is the one number the screen exists to
 * deliver. The old version squeezed "3d 22h" into a corner above a 2px progress
 * rail; at the start of a booking window the rail's lime fill was a few pixels
 * wide and read as a stray hairline next to the divider below it, so it was
 * decoration that told a student nothing the digits did not. It is gone.
 *
 * The blocks carry the tinted wash rather than the accent: two solid lime tiles
 * side by side is a lot of accent for something that is information, and the
 * accent is spent on the thing worth pressing. `ink-700` on `lime-faint` is the
 * pairing the tokens define for exactly this — full ink on a tinted ground is
 * too heavy at this size.
 *
 * Under six hours the "closing soon" pill appears. That is the one moment the
 * accent is warranted here: "later" has stopped being a safe assumption.
 */
export function WaveCountdown({ wave }: { wave: WaveInfo }) {
  const parts = countdownParts(wave.msLeft);

  return (
    <View
      className="rounded-card bg-surface p-4"
      accessible
      // One label for the whole card. Read block by block a screen reader says
      // "3 days 22 hours to order", which is right, but it arrives as four
      // separate stops for what is a single fact.
      accessibilityRole="text"
      accessibilityLabel={
        wave.closed
          ? `${wave.name}. Ordering has closed.`
          : `${wave.name}, arriving ${wave.dateLabel}. ${wave.countdown} left to order.${
              wave.closingSoon ? " Closing soon." : ""
            }`
      }
    >
      <Text className="font-sans-medium text-ui text-ink" numberOfLines={1}>
        {wave.name}
      </Text>
      <Text className="font-sans text-body text-muted" numberOfLines={1}>
        Arriving {wave.dateLabel}
      </Text>

      {wave.closed ? (
        <Text className="mt-4 font-sans-medium text-body text-ink">
          Ordering has closed for this one.
        </Text>
      ) : (
        <View className="mt-4 flex-row items-center">
          {parts.map((part) => (
            <View
              key={part.unit}
              // Fixed width, not `min-w`: sized to the longest unit word
              // ("minutes") so the pair stays the same size as the countdown
              // steps down through days/hours/minutes. Sizing to content made
              // "3 days" visibly narrower than "19 hours".
              //
              // `input` radius, not `card` — these sit inside a card, and a
              // 12px tile inside a 12px card reads as a nested card.
              className="mr-2 w-[84px] items-center rounded-input bg-lime-faint px-3 py-2"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text className="font-sans-bold text-heading text-ink">{part.value}</Text>
              <Text className="font-sans text-meta text-ink-700">{part.unit}</Text>
            </View>
          ))}

          <View className="ml-1 flex-1" accessibilityElementsHidden>
            {wave.closingSoon ? (
              <View className="self-start rounded-pill bg-lime px-2.5 py-1">
                <Text className="font-sans-medium text-meta text-ink">closing soon</Text>
              </View>
            ) : (
              <Text className="font-sans text-body text-muted">to order</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
