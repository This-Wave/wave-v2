import { Text, View } from "react-native";
import type { WaveInfo } from "../../lib/wave";
import { countdownParts } from "../../lib/wave";

/**
 * How long is left to join the next Wave, as a counter.
 *
 * Lives on the Wave calendar screen. Home says which Wave is next in a single
 * strip; someone who taps through to change the day is here because the timing
 * matters to them, so this is where the full counter belongs.
 *
 * There is no progress rail. The one this replaced was 2px with a lime fill, so
 * at the start of a booking window it was a few pixels wide and sat a few pixels
 * from a real divider — decoration that told a student nothing the digits did
 * not.
 *
 * The blocks carry the tinted wash rather than the accent: two solid lime tiles
 * side by side is a lot of accent for information, and `ink-700` on `lime-faint`
 * is the pairing the tokens define for exactly this. Under six hours the
 * "closing soon" pill appears, which is the one moment the solid accent is
 * warranted here.
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
