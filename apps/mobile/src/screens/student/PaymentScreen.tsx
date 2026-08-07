import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { CardIcon, CheckIcon, MobileIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useInitiatePayment, waitForPayment } from "../../lib/payments";
import { useAuthStore } from "../../store/authStore";
import { formatGhs, formatGhsCompact } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "Payment">;
type Method = "momo" | "card";

/**
 * Checkout.
 *
 * The amount is the whole screen — set at display size on the canvas with no
 * card around it, because there is exactly one number the student is deciding
 * about.
 *
 * Nothing here decides whether payment succeeded. The browser closing means the
 * student is back, not that they paid; only the signed Paystack webhook
 * confirms an order, so this asks the API and waits for it.
 */
export function PaymentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const profile = useAuthStore((s) => s.profile);
  const initiatePayment = useInitiatePayment();
  const [method, setMethod] = useState<Method>("momo");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function handlePay() {
    setError(null);

    let reference: string;
    let paymentUrl: string;
    try {
      ({ reference, payment_url: paymentUrl } = await initiatePayment.mutateAsync({
        orderId: params.orderId,
        method,
      }));
    } catch {
      // Nothing was charged — checkout never opened. Stay put so they can retry
      // without losing the screen.
      setError("Couldn't start the payment. Check your connection and try again.");
      return;
    }

    // An in-app browser, not Linking.openURL: this resolves when the student
    // closes it, which is what gives us a moment to check the outcome.
    setVerifying(true);
    try {
      await WebBrowser.openBrowserAsync(paymentUrl, { showTitle: true, enableBarCollapsing: true });
      const status = await waitForPayment(reference);
      if (status) {
        navigation.replace("OrderConfirmed", { orderId: params.orderId });
      } else {
        // Not necessarily a failure — they may have abandoned checkout, or the
        // webhook may still be in flight. Either way we must not claim success.
        navigation.replace("PaymentFailed", {
          orderId: params.orderId,
          totalAmount: params.totalAmount,
        });
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text className="font-sans text-body text-muted">You're paying</Text>
          <Text className="mb-10 mt-1 font-sans-bold text-ink" style={{ fontSize: 48, lineHeight: 52 }}>
            {formatGhsCompact(params.totalAmount)}
          </Text>

          <Text className="mb-3 font-sans-medium text-subheading text-ink">How?</Text>
          <View className="gap-2">
            <MethodRow
              label="Mobile Money"
              meta={profile?.phone ?? "MTN · Telecel · AirtelTigo"}
              icon={<MobileIcon size={20} color={colors.ink} strokeWidth={1.7} />}
              selected={method === "momo"}
              onPress={() => setMethod("momo")}
            />
            <MethodRow
              label="Card"
              meta="Visa or Mastercard"
              icon={<CardIcon size={20} color={colors.ink} strokeWidth={1.7} />}
              selected={method === "card"}
              onPress={() => setMethod("card")}
            />
          </View>

          <Text className="mt-6 font-sans text-body text-muted">
            Paystack handles the payment. Checkout opens inside the app and you come straight back.
          </Text>
          {error ? <Text className="mt-4 font-sans text-body text-danger">{error}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label={verifying ? "Confirming…" : `Pay ${formatGhs(params.totalAmount)}`}
          onPress={handlePay}
          disabled={initiatePayment.isPending || verifying}
          loading={initiatePayment.isPending || verifying}
        />
      </ActionBar>
    </Screen>
  );
}

function MethodRow({
  label,
  meta,
  icon,
  selected,
  onPress,
}: {
  label: string;
  meta: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-3 rounded-card p-4 ${
        selected ? "bg-lime-faint" : "bg-surface"
      }`}
    >
      {icon}
      <View className="flex-1">
        <Text className="font-sans-medium text-body text-ink">{label}</Text>
        <Text className="font-sans text-body text-muted">{meta}</Text>
      </View>
      {selected ? <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}
