import { Pressable, Text, View } from "react-native";
import type { WaveInfo } from "../../lib/wave";
import { ProgressRail } from "./Progress";
import { ChevronRightIcon } from "../icons";
import { colors } from "../../theme/tokens";

/**
 * The next Wave and how long is left to join it.
 *
 * v5 gave this a 47-hour countdown in 40px numerals occupying a third of the
 * screen, which read as an emergency for what is a twice-weekly schedule. It is
 * back because the deadline is real and students need to feel it — but sized as
 * information, not alarm: the Wave's name leads, the countdown is a single line
 * beside it, and the rail carries the urgency visually.
 *
 * Under six hours it marks itself urgent with one lime pill, not a lime
 * ground. A whole card of accent shouts across everything else on the screen,
 * and Home carries several cards; the deadline has to read as urgent without
 * taking the page over.
 */
export function WaveBanner({ wave, onPress }: { wave: WaveInfo; onPress?: () => void }) {
  const urgent = wave.closingSoon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${wave.name}, ordering closes in ${wave.countdown}`}
      accessibilityHint={onPress ? "Opens the calendar to pick a different Wave" : undefined}
      className="rounded-card bg-surface p-4"
    >
      <View className="mb-3 flex-row items-end justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
            {wave.name}
          </Text>
          <Text className="font-sans text-body text-muted" numberOfLines={1}>
            Arriving {wave.dateLabel}
          </Text>
        </View>

        <View className="items-end">
          <Text className="font-sans-bold text-heading-sm text-ink">{wave.countdown}</Text>
          {urgent ? (
            <View className="mt-0.5 rounded-pill bg-lime px-2 py-0.5">
              <Text className="font-sans-medium text-meta text-ink">closing soon</Text>
            </View>
          ) : (
            <Text className="font-sans text-meta text-muted">to order</Text>
          )}
        </View>
      </View>

      {/* One rail in both states. An ink rail at 95% elapsed reads as a solid
          black bar across the card, which is louder than the lime ground it
          replaced; the pill above carries the urgency instead. */}
      <ProgressRail ratio={wave.elapsed} />

      {/*
        The card was pressable and nothing said so, which left the calendar
        behind it effectively undiscoverable — students could not change the day
        because they never learned the countdown was a control. A named row with
        a chevron, under a rule: the card above still reads as information, the
        last line unmistakably as something you press.
      */}
      {onPress ? (
        <View
          className="mt-3 flex-row items-center justify-between border-t border-hairline pt-3"
        >
          <Text className="font-sans-medium text-body text-ink">See all Waves</Text>
          <ChevronRightIcon size={18} color={colors.ink} strokeWidth={2} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Shown once the cutoff has passed and the next Wave has not opened. */
export function WaveClosedBanner({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      // Two Texts, and the second carries the only actionable part ("Tap to see
      // the next one"). Grouped so the banner is one stop that states the
      // situation and the way out of it.
      accessible
      accessibilityLabel="Today's Wave has closed. Orders lock at noon."
      accessibilityHint={onPress ? "Opens the calendar for the next Wave" : undefined}
      className="rounded-card bg-surface p-4"
    >
      <Text className="font-sans-medium text-body text-ink">Today's Wave has closed</Text>
      <Text className="font-sans text-body text-muted">
        Orders lock at noon. Tap to see the next one.
      </Text>
    </Pressable>
  );
}
