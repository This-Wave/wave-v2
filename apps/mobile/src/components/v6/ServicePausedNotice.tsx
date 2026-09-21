import { Text, View } from "react-native";

function formatResume(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * "We're not taking orders right now", in the words staff wrote when they
 * paused. Shown on Home, above the fold, rather than at checkout — finding out
 * after building a basket is the version of this that makes people angry.
 *
 * A live region, because the pause can arrive while the screen is open.
 */
export function ServicePausedNotice({
  service,
  message,
  resumeAt,
}: {
  service: string;
  message: string;
  resumeAt: string | null;
}) {
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="rounded-card bg-surface p-4"
    >
      <Text className="font-sans-medium text-body text-ink">{service} is paused</Text>
      <Text className="mt-1 font-sans text-body text-ink">{message}</Text>
      {resumeAt ? (
        <Text className="mt-1 font-sans text-body text-muted">Back {formatResume(resumeAt)}.</Text>
      ) : null}
    </View>
  );
}
