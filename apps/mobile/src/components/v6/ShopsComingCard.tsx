import { Text, View } from "react-native";
import { Button } from "./Button";

/**
 * "Shops are coming — tell us which", before Buy for me launches.
 *
 * Two jobs. It says what is next without promising a date, so the missing half
 * of Wave reads as deliberate rather than broken. And it is the only way a
 * student on a phone can suggest a shop while the shop list is hidden — which
 * is the demand signal that decides which shops get onboarded first, so it
 * cannot live behind the catalogue it is meant to fill.
 */
export function ShopsComingCard({ onSuggest }: { onSuggest: () => void }) {
  return (
    <View className="rounded-card bg-surface p-5">
      <Text className="font-sans-medium text-body text-ink">Shop orders are coming</Text>
      <Text className="mt-1 font-sans text-body text-muted">
        We&apos;re signing up shops around campus now. Tell us where you actually buy, and the places
        the most people ask for open first.
      </Text>
      <View className="mt-4 self-start">
        <Button label="Suggest a shop" full={false} onPress={onSuggest} />
      </View>
    </View>
  );
}
