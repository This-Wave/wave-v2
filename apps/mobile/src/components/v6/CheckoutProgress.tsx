import { Text, View } from "react-native";

const STEPS = ["Menu", "Details", "Pay"] as const;

/** Checkout step indicator — 1-based step index. */
export function CheckoutProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View className="mb-6">
      <Text className="mb-3 font-sans-semibold text-meta text-muted">
        STEP {step} OF {STEPS.length} — {STEPS[step - 1]?.toUpperCase()}
      </Text>
      <View className="flex-row gap-2">
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
