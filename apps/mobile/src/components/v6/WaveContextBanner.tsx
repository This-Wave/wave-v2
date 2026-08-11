import { Text, View } from "react-native";
import { formatFullDay } from "../../lib/pricing";

/** Sticky context for checkout — which Wave and checkpoint apply. */
export function WaveContextBanner({
  scheduledDate,
  checkpointName,
  isSpecialOrder,
}: {
  scheduledDate: string;
  checkpointName?: string;
  isSpecialOrder?: boolean;
}) {
  const day = formatFullDay(new Date(scheduledDate));
  return (
    <View className="mb-6 rounded-card bg-surface px-4 py-3">
      <Text className="font-sans-medium text-body text-ink">
        {day}
        {isSpecialOrder ? " · Rush Wave" : ""}
      </Text>
      {checkpointName ? (
        <Text className="mt-0.5 font-sans text-body text-muted">To {checkpointName}</Text>
      ) : null}
    </View>
  );
}
