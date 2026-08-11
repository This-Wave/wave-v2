import { Text, View } from "react-native";
import { CheckIcon } from "../icons";
import { colors } from "../../theme/tokens";

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
              className={`h-4 w-4 items-center justify-center rounded-[6px] ${
                step.state === "done"
                  ? "bg-wave-500"
                  : step.state === "active"
                    ? "bg-wave-lime"
                    : "border border-border bg-canvas"
              }`}
            >
              {step.state === "done" ? <CheckIcon size={9} color={colors.white} strokeWidth={3} /> : null}
            </View>
            {index < steps.length - 1 ? (
              <View className={`h-[2px] flex-1 ${step.state === "upcoming" ? "bg-border" : "bg-wave-500"}`} />
            ) : null}
          </View>
        ))}
      </View>
      <View className="mt-1.5 flex-row justify-between">
        {steps.map((step) => (
          <Text
            key={step.label}
            className={`text-[10px] ${
              step.state === "upcoming" ? "text-faint" : "font-sans-medium text-muted"
            }`}
          >
            {step.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
