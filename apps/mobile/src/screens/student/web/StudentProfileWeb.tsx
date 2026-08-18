import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../../navigation/StudentNavigator";
import {
  Confirm,
  Gutter,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
} from "../../../components/v6";
import { useAuthStore } from "../../../store/authStore";
import { useMyOrders } from "../../../lib/orders";
import { signOut } from "../../../lib/auth";
import { formatGhs } from "../../../lib/pricing";
import { openPaymentMethods } from "../../../lib/desktopNavigate";
import { DEFAULT_LOYALTY_DISCOUNT_PCT, DEFAULT_LOYALTY_THRESHOLD } from "@wave/shared";
import {
  hasSupportContact,
  openSupportContact,
  supportContactLabel,
} from "../../../lib/support";

/** Desktop profile — account panel + settings column. */
export function StudentProfileWeb() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: orders } = useMyOrders();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const completed = (orders ?? []).filter((o) => o.status === "delivered").length;
  const saved = (orders ?? []).reduce((sum, o) => {
    const pct = Number(o.discountApplied ?? 0);
    const fee = Number(o.deliveryFee ?? 0);
    return sum + (fee * pct) / 100;
  }, 0);
  const remaining = Math.max(0, DEFAULT_LOYALTY_THRESHOLD - completed);
  const unlocked = completed >= DEFAULT_LOYALTY_THRESHOLD;

  return (
    <Screen>
      <ScreenBody bottomInset={48}>
        <Gutter className="pb-8 pt-8">
          <Text className="font-sans-bold text-heading text-ink">Account</Text>
          <Text className="mt-1 font-sans text-ui text-muted">
            Your Wave profile and delivery preferences.
          </Text>
        </Gutter>

        <Gutter>
          <View className="flex-row flex-wrap" style={{ gap: 24 }}>
            <View className="rounded-card bg-surface p-6" style={{ flex: 1, minWidth: 280 }}>
              <Text className="font-sans-bold text-heading-sm text-ink">
                {profile?.fullName ?? "Student"}
              </Text>
              <Text className="mt-2 font-sans text-body text-muted">
                {[profile?.studentId, profile?.phone].filter(Boolean).join(" · ") || "—"}
              </Text>

              <View className="mt-6 border-t border-hairline pt-5">
                <Text className="mb-2 font-sans-semibold text-meta text-muted">LOYALTY</Text>
                {unlocked ? (
                  <Text className="font-sans text-body text-ink">
                    {DEFAULT_LOYALTY_DISCOUNT_PCT}% off every delivery fee. Saved{" "}
                    <Text className="font-sans-semibold">{formatGhs(saved)}</Text> across{" "}
                    {completed} deliveries.
                  </Text>
                ) : (
                  <Text className="font-sans text-body text-ink">
                    {remaining} more {remaining === 1 ? "delivery" : "deliveries"} unlocks{" "}
                    {DEFAULT_LOYALTY_DISCOUNT_PCT}% off fees. You’re at {completed} of{" "}
                    {DEFAULT_LOYALTY_THRESHOLD}.
                  </Text>
                )}
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 280 }}>
              <RowGroup>
                <Row
                  title="Delivery checkpoints"
                  meta="Where your runner meets you"
                  onPress={() => navigation.navigate("Checkpoints")}
                />
                <Row
                  title="Payment"
                  meta="How you pay for deliveries"
                  onPress={() => openPaymentMethods(navigation)}
                />
                {hasSupportContact() ? (
                  <Row
                    title="Help & support"
                    meta={supportContactLabel()}
                    onPress={() => void openSupportContact()}
                  />
                ) : null}
              </RowGroup>
              <View className="mt-6">
                <Row title="Log out" onPress={() => setConfirmLogout(true)} chevron={false} />
              </View>
            </View>
          </View>
        </Gutter>
      </ScreenBody>

      <Confirm
        visible={confirmLogout}
        title="Log out?"
        body="You'll need your phone number and a code to get back in."
        confirmLabel="Log out"
        onConfirm={() => {
          setConfirmLogout(false);
          void signOut();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </Screen>
  );
}
