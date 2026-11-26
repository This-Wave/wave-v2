import { Text, View } from "react-native";

const STEPS = [
  { title: "Tell us who is sending it", body: "Their name, number and where in Accra. A rider goes to them." },
  { title: "A rider brings it in", body: "A verified Wave rider carries it to campus on the next Wave." },
  { title: "You collect it", body: "Show your 6-digit code at your pickup point on campus." },
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
    <View className="rounded-card border border-hairline bg-surface p-5" accessible accessibilityRole="summary">
      <Text className="mb-4 font-sans-bold text-body text-ink">How a pickup works</Text>
      {STEPS.map((step, i) => (
        <View key={step.title} className={`flex-row ${i === STEPS.length - 1 ? "" : "mb-4"}`}>
          {/* Ink disc, white numeral: lime is fill-only and white on lime fails
              contrast, so the accent cannot carry a number. */}
          <View className="mr-3 h-6 w-6 items-center justify-center rounded-pill bg-ink">
            <Text className="font-sans-semibold text-caption text-surface">{i + 1}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-sans-bold text-body text-ink">{step.title}</Text>
            <Text className="mt-0.5 font-sans text-body text-muted">{step.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
