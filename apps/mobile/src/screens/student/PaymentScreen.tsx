import { useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { PaymentMethodRow } from "../../components/ui/PaymentMethodRow";
import { Button } from "../../components/ui/Button";
import { CardIcon, MobileIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useInitiatePayment, waitForPayment } from "../../lib/payments";
import { useAuthStore } from "../../store/authStore";
import { formatGhs, formatGhsCompact } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "Payment">;
type Method = "momo" | "card";

/**
 * Checkout, built on the v5 payment-method rows (screen 15) with the amount
 * shown in the screen-06 total treatment. The chosen method is sent to the API,
 * which restricts Paystack to that channel so checkout opens where the student
 * expects rather than asking them to choose again.
 *
 * Nothing here decides whether payment succeeded. The browser closing means the
 * student is back, not that they paid — only the Paystack webhook confirms an
 * order, so this asks the API and waits for it.
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
    // closes it, which is what gives us a moment to check the outcome. Handing
    // off to the system browser left the app with no idea what happened and no
    // way back.
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
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Payment" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-7 items-center">
          <Text className="mb-1.5 font-sans-medium text-[12px] uppercase tracking-[0.6px] text-muted">Amount due</Text>
          <Text className="font-sans-semibold text-[40px] tracking-tighter text-wave-500">
            {formatGhsCompact(params.totalAmount)}
          </Text>
        </View>

        <Text className="mb-3 font-sans-semibold text-[18px] text-ink">Pay with</Text>
        <View className="gap-3">
          <PaymentMethodRow
            label="Mobile Money"
            subtitle={profile?.phone ?? "MTN · Telecel · AirtelTigo"}
            icon={<MobileIcon />}
            selected={method === "momo"}
            onPress={() => setMethod("momo")}
          />
          <PaymentMethodRow
            label="Card"
            subtitle="Visa or Mastercard"
            icon={<CardIcon size={18} color={colors.ink} strokeWidth={1.6} />}
            selected={method === "card"}
            onPress={() => setMethod("card")}
          />
        </View>

        <Text className="mt-5 text-center text-[12px] text-muted">
          Payments are secured by Paystack. Checkout opens here in the app.
        </Text>
        {error ? <Text className="mt-3 text-center text-[12px] text-danger-text">{error}</Text> : null}
      </ScrollView>

      <View className="border-t border-border bg-canvas px-5 pb-11 pt-4">
        <Button
          label={verifying ? "Confirming payment…" : `Pay ${formatGhs(params.totalAmount)}`}
          onPress={handlePay}
          disabled={initiatePayment.isPending || verifying}
          loading={initiatePayment.isPending || verifying}
        />
      </View>
    </SafeAreaView>
  );
}
