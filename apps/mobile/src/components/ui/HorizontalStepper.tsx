import { Text, View } from "react-native";
import { Check } from "lucide-react-native";

export type StepState = "done" | "active" | "upcoming";

interface Step {
  label: string;
  state: StepState;
}

export function HorizontalStepper({ steps }: { steps: Step[] }) {
  return (
    <View>
      <View className="flex-row items-center">
        {steps.map((step, index) => (
          <View key={step.label} className="flex-1 flex-row items-center">
            <View
              className={`h-4 w-4 items-center justify-center rounded-full ${
                step.state === "done"
                  ? "bg-wave-500"
                  : step.state === "active"
                    ? "border-2 border-wave-500 bg-surface"
                    : "border-2 border-border bg-surface-muted"
              }`}
            >
              {step.state === "done" ? <Check size={9} color="#fff" strokeWidth={3} /> : null}
            </View>
            {index < steps.length - 1 ? (
              <View className={`h-0.5 flex-1 ${step.state === "upcoming" ? "bg-border" : "bg-wave-500"}`} />
            ) : null}
          </View>
        ))}
      </View>
      <View className="mt-1 flex-row justify-between">
        {steps.map((step) => (
          <Text
            key={step.label}
            className={`text-[9px] ${step.state === "active" ? "font-sans-semibold text-wave-500" : "text-muted"}`}
          >
            {step.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
