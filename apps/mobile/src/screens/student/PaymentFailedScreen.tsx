import { SafeAreaView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Button } from "../../components/ui/Button";
import { AlertIcon } from "../../components/icons";
import { formatGhs } from "../../lib/pricing";
import { shortOrderRef } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "PaymentFailed">;

/** v5 screen 19 error state, applied to a failed charge. */
export function PaymentFailedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title={`Order ${shortOrderRef(params.orderId)}`} onBack={() => navigation.goBack()} />

      <View className="flex-1 items-center justify-center px-10">
        <View className="mb-6 h-[84px] w-[84px] items-center justify-center rounded-card bg-danger-bg">
          <AlertIcon />
        </View>
        <Text className="mb-2.5 text-center font-sans-semibold text-[20px] text-ink">Payment didn&apos;t go through</Text>
        <Text className="mb-7 text-center text-[14px] leading-[21px] text-muted">
          We couldn&apos;t collect {formatGhs(params.totalAmount)}. Your order is safe and unpaid — try again or use a
          different payment method.
        </Text>
        <View className="w-full gap-3">
          <Button
            label="Try again"
            onPress={() =>
              navigation.replace("Payment", { orderId: params.orderId, totalAmount: params.totalAmount })
            }
          />
          <Button
            label="Back to home"
            variant="secondary"
            size="compact"
            onPress={() => navigation.navigate("Tabs", { screen: "Home" })}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
