import { SafeAreaView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { X } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";
import { formatGhs } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "PaymentFailed">;

export function PaymentFailedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <EmptyState
        icon={X}
        severity="error"
        title="Payment Failed"
        description="Your MTN MoMo charge could not be completed."
      >
        <View className="flex-row justify-between rounded-well border border-border p-3.5">
          <Text className="text-[12px] text-text-secondary">Amount</Text>
          <Text className="font-sans-bold text-[12px] text-ink">{formatGhs(params.totalAmount)}</Text>
        </View>
        <View className="rounded-well border border-danger-border bg-danger-bg p-3.5">
          <Text className="text-[12px] leading-5 text-danger-text">
            Insufficient balance. Top up your MoMo wallet and retry.
          </Text>
        </View>
        <Button label="Try Again" onPress={() => navigation.replace("Payment", { orderId: params.orderId, totalAmount: params.totalAmount })} />
        <Button label="Cancel Order" variant="secondary" onPress={() => navigation.navigate("Tabs")} />
      </EmptyState>
    </SafeAreaView>
  );
}
