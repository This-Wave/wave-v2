import { Text, View } from "react-native";
import type { StepState } from "./HorizontalStepper";

interface TimelineStep {
  title: string;
  subtitle?: string;
  state: StepState;
  /** Renders the subtitle in green semibold (the live ETA on screen 10). */
  emphasis?: boolean;
}

/**
 * v5 screen 10: 12px squared dot (radius 5), 2px rail, 44px minimum segment,
 * 26px gap below each entry. Completed steps are solid green, the live step is
 * lime, and pending steps fade to #B7C4AE.
 */
export function VerticalTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <View>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const dotClass =
          step.state === "done" ? "bg-wave-500" : step.state === "active" ? "bg-wave-lime" : "bg-border";
        const railClass = step.state === "done" ? "bg-wave-500" : "bg-border";
        const pending = step.state === "upcoming";

        return (
          <View key={step.title} className="flex-row gap-4">
            <View className="items-center">
              <View className={`h-3 w-3 rounded-[5px] ${dotClass}`} />
              {!isLast ? <View className={`w-[2px] flex-1 ${railClass}`} style={{ minHeight: 44 }} /> : null}
            </View>
            <View className={isLast ? "" : "pb-[26px]"}>
              <Text className={`font-sans-semibold text-[15px] ${pending ? "text-faint" : "text-ink"}`}>
                {step.title}
              </Text>
              {step.subtitle ? (
                <Text
                  className={`text-[12px] ${
                    pending ? "text-faint" : step.emphasis ? "font-sans-semibold text-wave-500" : "text-muted"
                  }`}
                >
                  {step.subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
