import { Text, View } from "react-native";
import { Button, Gutter, Screen, ScreenBody } from "../../components/v6";
import { useAuthStore } from "../../store/authStore";

/**
 * Orders and Profile for someone browsing without an account. There is
 * nothing of theirs to show yet, so it says that once and offers the one way
 * to get an account. Coming back lands on the same tab.
 */
export function GuestTabScreen({ tab }: { tab: "Orders" | "Profile" }) {
  const beginSignupFromGuest = useAuthStore((s) => s.beginSignupFromGuest);
  const endGuest = useAuthStore((s) => s.endGuest);
  return (
    <Screen>
      <ScreenBody>
        <Gutter className="pt-16">
          <Text accessibilityRole="header" className="mb-2 font-sans-bold text-heading text-ink">
            {tab === "Orders" ? "Your orders" : "Your profile"}
          </Text>
          <Text className="mb-8 font-sans text-body text-muted">
            {tab === "Orders" ? "They show here once you have an account." : "Sign in with your phone number."}
          </Text>
          <View className="gap-3">
            <Button
              label="Continue with phone number"
              onPress={() => beginSignupFromGuest({ route: "Tabs", params: { screen: tab } })}
            />
            {tab === "Profile" ? (
              <Button label="Back to the welcome screen" variant="quiet" onPress={endGuest} />
            ) : null}
          </View>
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
