import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { Gutter, PageTitle, Row, RowGroup, Screen, ScreenBody, TopBar } from "../../components/v6";
import { useAuthStore } from "../../store/authStore";

/**
 * How payment works, stated rather than managed.
 *
 * There is nothing to manage: Wave stores no payment instruments. Paystack
 * collects the details at checkout and Wave never sees them, so a "saved cards"
 * list would be an empty container promising a feature that does not exist —
 * which is exactly the "Save card" control PR #15 removed for storing nothing.
 */
export function PaymentMethodsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={24}>
        <Gutter className="pb-8 pt-2">
          <PageTitle>Payment</PageTitle>
          <Text className="mt-2 font-sans text-body text-muted">
            You choose how to pay each time you check out.
          </Text>
        </Gutter>

        <Gutter>
          <RowGroup>
            <Row
              title="Mobile Money"
              meta={profile?.phone ?? "MTN · Telecel · AirtelTigo"}
              chevron={false}
            />
            <Row title="Card" meta="Visa or Mastercard" chevron={false} />
          </RowGroup>

          <View className="mt-6 rounded-card bg-surface p-5">
            <Text className="mb-1 font-sans-semibold text-meta text-muted">
              WHY THERE'S NOTHING TO SET UP
            </Text>
            <Text className="font-sans text-body text-ink">
              Paystack handles the payment and keeps your card or wallet details. Wave never sees or
              stores them, so there's nothing here to save or delete.
            </Text>
          </View>
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
