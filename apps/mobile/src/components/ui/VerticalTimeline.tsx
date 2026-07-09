import { Text, View } from "react-native";
import { Check } from "lucide-react-native";
import type { StepState } from "./HorizontalStepper";

interface TimelineStep {
  title: string;
  subtitle?: string;
  state: StepState;
}

export function VerticalTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <View>
      {steps.map((step, index) => (
        <View key={step.title} className="flex-row">
          <View className="items-center">
            <View
              className={`h-5 w-5 items-center justify-center rounded-full ${
                step.state === "done"
                  ? "bg-wave-500"
                  : step.state === "active"
                    ? "border-2 border-wave-500 bg-surface"
                    : "border-2 border-border bg-surface-muted"
              }`}
            >
              {step.state === "done" ? <Check size={11} color="#fff" strokeWidth={3} /> : null}
            </View>
            {index < steps.length - 1 ? <View className="w-0.5 flex-1 bg-border" style={{ minHeight: 28 }} /> : null}
          </View>
          <View className="ml-3 flex-1 pb-4">
            <Text className="font-sans-bold text-[13px] text-ink">{step.title}</Text>
            {step.subtitle ? <Text className="mt-0.5 text-[11px] text-muted">{step.subtitle}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
