import { Text, View } from "react-native";
import { loyaltyProgress, loyaltyProgressLabel } from "@wave/shared";
import { BoxIcon } from "../icons";
import { colors } from "../../theme/tokens";

/**
 * The delivery discount as a stamp card.
 *
 * It replaces a paragraph of arithmetic ("6 more deliveries and you'll get 20%
 * off every delivery fee. You're at 0 of 6.") with the thing that paragraph was
 * describing. A stamp card is legible before it is read: you can see how many
 * you have and how many are left without parsing a sentence, which is the whole
 * reason coffee shops have used them for a century.
 *
 * One stamp per delivery, laid out to fill exactly — `threshold` is 6 by
 * default and the grid is three across, so it reads as two tidy rows rather
 * than a wrapped list. A threshold that is not a multiple of three still lays
 * out, it just ends ragged, which is honest about the number rather than
 * rounding it.
 *
 * Collected stamps carry the accent, which is the one place on this screen it
 * appears: this is the closest thing the profile has to a reward, and the box
 * glyph is the same one the "Send a package" action uses, so the stamp reads as
 * "a delivery" rather than as decoration.
 *
 * Uncollected stamps are a canvas square with a hairline and a grey glyph —
 * never `subtle`, which the tokens reserve for fills and which measures 1.8:1.
 * The sentence above states the count either way, so nothing here is carried by
 * colour alone.
 */
export function LoyaltyStamps({ completed }: { completed: number }) {
  const progress = loyaltyProgress(completed);
  // Past the threshold the card stops being a target and becomes a statement,
  // so it fills rather than showing a seventh stamp with nowhere to go.
  const filled = Math.min(progress.completed, progress.threshold);

  return (
    <View
      className="rounded-card bg-surface p-5"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Delivery stamps. ${filled} of ${progress.threshold} collected. ${loyaltyProgressLabel(progress)}`}
      accessibilityValue={{ min: 0, max: progress.threshold, now: filled }}
    >
      <View className="mb-4 flex-row items-baseline justify-between">
        <Text className="font-sans-medium text-ui text-ink">Delivery stamps</Text>
        <Text className="font-sans text-meta text-muted">
          {filled} of {progress.threshold}
        </Text>
      </View>

      {/* Decorative in the assistive-tech sense: the label above carries the
          same numbers, and six separate swipe stops that each say "box" would
          be worse than one that says the whole thing. */}
      <View
        className="flex-row flex-wrap"
        style={{ gap: 10 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: progress.threshold }, (_, i) => {
          const collected = i < filled;
          return (
            <View
              key={i}
              className={`h-[58px] flex-1 items-center justify-center rounded-input ${
                collected ? "bg-lime" : "border border-hairline bg-canvas"
              }`}
              style={{ minWidth: 72, maxWidth: "31%" }}
            >
              <BoxIcon
                size={24}
                color={collected ? colors.ink : colors.icon}
                strokeWidth={collected ? 1.9 : 1.6}
              />
            </View>
          );
        })}
      </View>

      <Text className="mt-4 font-sans text-body text-ink-700">
        {progress.earned
          ? `Card full — ${progress.discountPct}% off the delivery fee on every order.`
          : `${progress.remaining} more ${progress.remaining === 1 ? "delivery" : "deliveries"} and the next card gets ${progress.discountPct}% off the delivery fee.`}
      </Text>
    </View>
  );
}
