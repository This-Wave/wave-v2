import { Text, View } from "react-native";
import { Button } from "./Button";
import { WaveMarkIcon } from "../icons";

/**
 * The ad space: a headline, a line of copy, one button, and the mark.
 *
 * Shaped after the reference's promo block ("Timeless style. Made simple." /
 * "Curated picks that make life easier." / Shop Now). Kept as a slot rather
 * than a one-off card, because what belongs in it changes with the product:
 * before launch it is the shops that are coming, after launch it is whatever is
 * worth a student's attention that week.
 *
 * Where the reference puts a product photograph, this puts the Wave mark.
 * Wave has no illustration library, and the two rules that would have made a
 * decorative panel easy — a gradient ground, or white text on the accent — are
 * both out, so the art has to be the one graphic the brand owns.
 *
 * White on canvas with no border, like every other content card; the ad does
 * not get to shout louder than the deadline strip above it, which is the one
 * tinted block on the screen.
 */
export function PromoCard({
  headline,
  body,
  cta,
  onPress,
}: {
  headline: string;
  body: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <View className="overflow-hidden rounded-card bg-surface p-5">
      <View className="flex-row">
        <View className="min-w-0 flex-1 pr-3">
          <Text className="font-sans-bold text-heading-sm text-ink">{headline}</Text>
          <Text className="mt-1.5 font-sans text-body text-muted">{body}</Text>
        </View>

        {/* Decorative, and announced nowhere: the headline beside it already
            says what this is, so a screen reader meeting "Wave" again here
            would be hearing the furniture. */}
        <View
          className="overflow-hidden rounded-card"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <WaveMarkIcon size={56} />
        </View>
      </View>

      <View className="mt-4 self-start">
        <Button label={cta} full={false} onPress={onPress} />
      </View>
    </View>
  );
}
