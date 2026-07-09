import { useState } from "react";
import { Linking, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { PaymentMethodRow } from "../../components/ui/PaymentMethodRow";
import { Button } from "../../components/ui/Button";
import { useInitiatePayment } from "../../lib/payments";
import { useAuthStore } from "../../store/authStore";
import { formatGhs } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "Payment">;
type Method = "mtn" | "vodafone";

export function PaymentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const profile = useAuthStore((s) => s.profile);
  const initiatePayment = useInitiatePayment();
  const [method, setMethod] = useState<Method>("mtn");
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
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-1.5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-6 flex-row items-center gap-3">
          <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} />
          <Text className="font-sans-extrabold text-[17px] tracking-tight text-ink">Payment</Text>
        </View>

        <View className="mb-7 items-center">
          <Text className="mb-1 text-[12px] font-sans-medium text-muted">Amount Due</Text>
          <Text className="font-sans-extrabold text-[36px] tracking-tight text-ink">{formatGhs(params.totalAmount)}</Text>
        </View>

        <Text className="mb-2.5 font-sans-semibold text-xs text-text-secondary">Payment Method</Text>
        <View className="gap-2.5">
          <PaymentMethodRow
            label="MTN Mobile Money"
            logoBgClass="bg-mtn"
            logoLabel="MTN"
            selected={method === "mtn"}
            onPress={() => setMethod("mtn")}
          >
            <Text className="text-[12px] text-muted">{profile?.phone}</Text>
          </PaymentMethodRow>
          <PaymentMethodRow
            label="Vodafone Cash"
            logoBgClass="bg-vodafone"
            logoLabel="VOD"
            selected={method === "vodafone"}
            onPress={() => setMethod("vodafone")}
          />
        </View>

        <Text className="mt-5 text-center text-[11px] text-muted">Payments are secured by Paystack</Text>
        {error ? <Text className="mt-3 text-center text-[12px] text-danger-text">{error}</Text> : null}

        <View className="mt-7">
          <Button label={`Pay ${formatGhs(params.totalAmount)}`} onPress={handlePay} loading={initiatePayment.isPending} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
