import { Text, View } from "react-native";
import { CheckIcon } from "../icons";
import { colors } from "../../theme/tokens";

export interface Step {
  label: string;
  /** Sub-line: a timestamp once done, or what is being waited on. */
  detail?: string;
}

/**
 * Vertical order progress. Completed steps carry a lime disc with an ink check;
 * the current step is a hollow ink ring; future steps are a subtle dot.
 *
 * The accent appears here because progress is the one piece of status a student
 * actually came to the screen for.
 */
export function Steps({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
  return (
    <View>
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const last = i === steps.length - 1;
        return (
          <View key={step.label} className="flex-row">
            <View className="items-center" style={{ width: 28 }}>
              <View
                className={`h-6 w-6 items-center justify-center rounded-pill ${
                  done ? "bg-lime" : current ? "border-2 border-ink bg-surface" : "bg-hairline"
                }`}
              >
                {done ? <CheckIcon size={14} color={colors.ink} strokeWidth={2.4} /> : null}
              </View>
              {!last ? (
                <View className={`w-0.5 flex-1 ${done ? "bg-lime" : "bg-hairline"}`} />
              ) : null}
            </View>
            <View className={`flex-1 pl-3 ${last ? "pb-0" : "pb-7"}`}>
              <Text
                className={`font-sans-medium text-body ${
                  done || current ? "text-ink" : "text-subtle"
                }`}
              >
                {step.label}
              </Text>
              {step.detail ? (
                <Text className="font-sans text-body text-muted">{step.detail}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The hairline progress rail used on compact order cards — a 2px track where
 * the filled portion is the accent. Enough to read at a glance without the
 * space a full stepper needs.
 */
export function ProgressRail({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View className="h-0.5 w-full overflow-hidden rounded-pill bg-hairline">
      <View className="h-full rounded-pill bg-lime" style={{ width: `${pct}%` }} />
    </View>
  );
}
