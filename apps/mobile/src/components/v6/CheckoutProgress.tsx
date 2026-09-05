import { Text, View } from "react-native";

const STEPS = ["Menu", "Details", "Pay"] as const;

/**
 * Checkout step indicator — 1-based step index.
 *
 * The bars carry no information the label does not already state, so they are
 * hidden from assistive tech rather than announced as three unlabelled views.
 * The whole thing is one `progressbar` so a screen reader reports position the
 * way it would anywhere else, instead of reading a shouty text fragment.
 */
export function CheckoutProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View
      className="mb-6"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Checkout, step ${step} of ${STEPS.length}: ${STEPS[step - 1]}`}
      accessibilityValue={{ min: 1, max: STEPS.length, now: step }}
    >
      <Text className="mb-3 font-sans-semibold text-meta text-muted">
        STEP {step} OF {STEPS.length} — {STEPS[step - 1]?.toUpperCase()}
      </Text>
      <View className="flex-row gap-2" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {STEPS.map((_, i) => (
          <View
            key={i}
            className={`h-1 flex-1 rounded-pill ${i < step ? "bg-lime" : "bg-hairline"}`}
          />
        ))}
      </View>
    </View>
  );
}
