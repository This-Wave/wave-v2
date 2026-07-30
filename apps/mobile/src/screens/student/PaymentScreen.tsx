import { useState } from "react";
import { Linking, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { PaymentMethodRow } from "../../components/ui/PaymentMethodRow";
import { Button } from "../../components/ui/Button";
import { CardIcon, MobileIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useInitiatePayment } from "../../lib/payments";
import { useAuthStore } from "../../store/authStore";
import { formatGhs, formatGhsCompact } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "Payment">;
type Method = "momo" | "card";

/**
 * Checkout, built on the v5 payment-method rows (screen 15) with the amount
 * shown in the screen-06 total treatment. Both routes hand off to the same
 * Paystack checkout — the choice is a hint for which channel to expect.
 */
export function PaymentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const profile = useAuthStore((s) => s.profile);
  const initiatePayment = useInitiatePayment();
  const [method, setMethod] = useState<Method>("momo");
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setError(null);
    try {
      const result = await initiatePayment.mutateAsync(params.orderId);
      await Linking.openURL(result.payment_url);
      navigation.replace("OrderConfirmed", { orderId: params.orderId });
    } catch {
      setError("Payment failed to start.");
      navigation.replace("PaymentFailed", { orderId: params.orderId, totalAmount: params.totalAmount });
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
          Payments are secured by Paystack. You&apos;ll finish checkout in your browser.
        </Text>
        {error ? <Text className="mt-3 text-center text-[12px] text-danger-text">{error}</Text> : null}
      </ScrollView>

      <View className="border-t border-border bg-canvas px-5 pb-11 pt-4">
        <Button
          label={`Pay ${formatGhs(params.totalAmount)}`}
          onPress={handlePay}
          loading={initiatePayment.isPending}
        />
      </View>
    </SafeAreaView>
  );
}
