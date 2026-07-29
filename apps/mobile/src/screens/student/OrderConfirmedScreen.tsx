import { ActivityIndicator, SafeAreaView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { Button } from "../../components/ui/Button";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useOrder } from "../../lib/orders";
import { formatFullDay } from "../../lib/pricing";
import { shortOrderRef } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "OrderConfirmed">;

/**
 * v5 screen 08. Centred 84px lime check well, 26px headline, a supporting
 * paragraph, then the order-id / status card, with a stacked action pair.
 * (v4's dark-mode confirmation is gone — v5 keeps this screen on the canvas.)
 */
export function OrderConfirmedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId, { poll: true });

  const isConfirmed = !!order && order.status !== "payment_pending" && order.status !== "pending";
  const runDay = order ? formatFullDay(new Date(order.scheduledDate)) : null;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 h-[84px] w-[84px] items-center justify-center rounded-card bg-wave-lime">
          {isConfirmed ? (
            <CheckIcon size={38} color={colors.primary} strokeWidth={3} />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>

        <Text className="mb-2.5 text-center font-sans-semibold text-[26px] tracking-tight text-ink">
          {isConfirmed ? "Order confirmed" : "Confirming payment"}
        </Text>
        <Text className="mb-7 text-center text-[14px] leading-[21px] text-muted">
          {isConfirmed
            ? `Your request is locked into ${runDay ?? "the next"} run. We'll notify you when your runner is on the way, and your pickup PIN arrives by SMS.`
            : "Hold on while we confirm your payment with Paystack. This usually takes a few seconds."}
        </Text>

        <View className="w-full flex-row items-center justify-between rounded-card border border-border bg-surface p-4">
          <View>
            <Text className="font-sans-semibold text-[11px] uppercase tracking-[0.6px] text-muted">Order id</Text>
            <Text className="font-sans-semibold text-[15px] text-ink">
              {shortOrderRef(params.orderId).replace("#", "")}
            </Text>
          </View>
          <View className="rounded-pill border border-border bg-canvas px-3 py-[5px]">
            <Text className="font-sans-semibold text-[11px] text-wave-500">
              {isConfirmed ? "Scheduled" : "Pending"}
            </Text>
          </View>
        </View>
      </View>

      <View className="gap-3 px-7 pb-11 pt-4">
        <Button
          label="Track order"
          onPress={() => navigation.replace("OrderTracking", { orderId: params.orderId })}
          disabled={!isConfirmed}
        />
        <Button
          label="Back to home"
          variant="secondary"
          size="compact"
          onPress={() => navigation.navigate("Tabs", { screen: "Home" })}
        />
      </View>
    </SafeAreaView>
  );
}
