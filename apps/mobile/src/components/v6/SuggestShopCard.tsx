import { Text, View } from "react-native";
import { Button } from "./Button";

/**
 * "Can't find your shop?" — the way a student asks for a place Wave does not
 * carry yet.
 *
 * On Home rather than only inside the shop list's empty state: a student who
 * searched and found *something* never sees that empty state, so the shops
 * they wanted and settled for went unrecorded. Popular suggestions are what
 * decide which shop is onboarded next.
 */
export function SuggestShopCard({ onSuggest }: { onSuggest: () => void }) {
  return (
    <View className="rounded-card bg-surface p-5">
      <Text className="font-sans-medium text-body text-ink">Can&apos;t find your shop?</Text>
      <Text className="mt-1 font-sans text-body text-muted">
        Tell us where you buy and we&apos;ll send a runner. The places the most people ask for get
        their own menu.
      </Text>
      <View className="mt-4 self-start">
        <Button label="Suggest a shop" full={false} onPress={onSuggest} />
      </View>
    </View>
  );
}
