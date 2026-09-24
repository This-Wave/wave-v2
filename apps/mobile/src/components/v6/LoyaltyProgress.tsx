import { Text, View } from "react-native";
import { loyaltyProgress, loyaltyProgressLabel } from "@wave/shared";
import { useCompletedDeliveryCount } from "../../lib/orders";
import { useFeature } from "../../lib/features";

/**
 * How close a student is to the delivery discount.
 *
 * The discount has existed the whole time and was invisible until the moment it
 * fired — a student had no way to know it was coming, so it could not encourage
 * the sixth order it exists to encourage.
 *
 * Deliberately not lime. The accent is for things you press; this is a fact
 * about the account, and a progress bar in the CTA colour on the profile screen
 * would compete with the actual controls.
 *
 * Renders nothing when the flag is off, and nothing for a student with no
 * completed deliveries — telling someone on their first order that they are six
 * away from a discount is noise, not encouragement.
 */
export function LoyaltyProgress({ compact = false }: { compact?: boolean }) {
  const enabled = useFeature("loyalty_progress");
  const completed = useCompletedDeliveryCount();

  if (!enabled) return null;

  const progress = loyaltyProgress(completed);
  if (progress.completed === 0) return null;

  const ratio = progress.earned ? 1 : progress.completed / progress.threshold;
  const label = loyaltyProgressLabel(progress);

  return (
    <View
      className={`rounded-card bg-surface ${compact ? "p-4" : "p-5"}`}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: progress.threshold, now: progress.completed }}
    >
      <Text className="font-sans-medium text-body text-ink">{label}</Text>
      <Text className="mt-0.5 font-sans text-meta text-muted">
        {/* Once earned the ratio stops meaning anything and reads as a bug —
            the first run of this rendered "7 of 6 deliveries". */}
        {progress.earned
          ? `${progress.completed} ${progress.completed === 1 ? "delivery" : "deliveries"} so far`
          : `${progress.completed} of ${progress.threshold} deliveries`}
      </Text>

      {/* Hidden from assistive tech: the sentence above already says it, and a
          bar with no name is one more swipe stop carrying nothing. */}
      <View
        className="mt-3 h-1.5 overflow-hidden rounded-pill bg-hairline"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View
          className="h-full rounded-pill bg-ink"
          style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
        />
      </View>
    </View>
  );
}
