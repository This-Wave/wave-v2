import { Text, View } from "react-native";

const STEPS = [
  { title: "Drop it at a checkpoint", body: "Leave your parcel with the rider at the checkpoint you choose." },
  { title: "A rider brings it in", body: "On the next Wave, a verified Wave rider carries it onto campus." },
  { title: "Your person collects it", body: "They show the 6-digit code at the other checkpoint. That's the handover." },
];

/**
 * What a pickup actually is, in three steps.
 *
 * Buy for me explains itself — everyone has ordered food. Pickup does not, and
 * before Buy for me launches it is the whole product, so the screen has to
 * teach it rather than mention it. One card, numbered, no illustration: there
 * is no art in this system and a placeholder graphic would say less than the
 * sentences do.
 */
export function HowPickupWorks() {
  return (
    <View className="rounded-card bg-surface p-5" accessible accessibilityRole="summary">
      <Text className="mb-4 font-sans-medium text-body text-ink">How a pickup works</Text>
      {STEPS.map((step, i) => (
        <View key={step.title} className={`flex-row ${i === STEPS.length - 1 ? "" : "mb-4"}`}>
          {/* Ink disc, white numeral: lime is fill-only and white on lime fails
              contrast, so the accent cannot carry a number. */}
          <View className="mr-3 h-6 w-6 items-center justify-center rounded-pill bg-ink">
            <Text className="font-sans-semibold text-caption text-on-ink">{i + 1}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-sans-medium text-body text-ink">{step.title}</Text>
            <Text className="mt-0.5 font-sans text-body text-muted">{step.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
