import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { FeeBreakdownRow } from "../../components/ui/FeeBreakdownRow";
import { useOrder } from "../../lib/orders";
import { formatGhs, formatGhsCompact } from "../../lib/pricing";
import { initialsOf, shortOrderRef, statusBadge } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "OrderDetail">;

/**
 * v5 screen 13 "Order detail": the status header card, the items block, the
 * cost ledger with the green total, then the runner card.
 */
export function OrderDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);

  const itemPrice = order?.itemPrice ? Number(order.itemPrice) : 0;
  const deliveryFee = order ? Number(order.deliveryFee) : 0;
  const surcharge = order ? Number(order.surchargeApplied) : 0;
  const discount = order ? Number(order.discountApplied) : 0;
  const total = order ? Number(order.totalAmount) : 0;

  const deliveredLabel = order?.deliveredAt
    ? `Delivered ${new Date(order.deliveredAt).toLocaleDateString([], {
        weekday: "short",
        day: "numeric",
        month: "short",
      })} · ${new Date(order.deliveredAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : order
      ? `Scheduled ${new Date(order.scheduledDate).toLocaleDateString([], {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}`
      : "";

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title={`Order ${shortOrderRef(params.orderId)}`} onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-5 flex-row items-center justify-between rounded-card border border-border bg-surface p-[18px]">
          <View className="flex-1 pr-3">
            <Text className="mb-1 font-sans-semibold text-[13px] text-ink" numberOfLines={1}>
              {order?.shop ? `${order.shop.name} · Buy For Me` : "Package pickup"}
            </Text>
            <Text className="text-[12px] text-muted">{deliveredLabel}</Text>
          </View>
          {order ? <Badge {...statusBadge(order.status)} /> : null}
        </View>

        <Text className="mb-3 font-sans-semibold text-[18px] text-ink">Items</Text>
        <View className="mb-6 rounded-card border border-border bg-surface px-4 py-3.5">
          <Text className="text-[14px] leading-[22px] text-ink">{order?.itemDescription ?? "—"}</Text>
        </View>

        <Text className="mb-3 font-sans-semibold text-[18px] text-ink">Cost breakdown</Text>
        <FeeBreakdownRow label="Items" value={itemPrice > 0 ? formatGhs(itemPrice) : "Paid at pickup"} />
        <FeeBreakdownRow label="Delivery" value={formatGhs(deliveryFee)} />
        {surcharge > 0 ? <FeeBreakdownRow label="Special order surcharge" value={`+${formatGhs(surcharge)}`} /> : null}
        {discount > 0 ? (
          <FeeBreakdownRow label="Loyalty discount" value={`-${formatGhs(discount)}`} isDiscount />
        ) : null}
        <FeeBreakdownRow label="Total paid" value={formatGhsCompact(total)} isTotal />

        {order?.rider ? (
          <View className="mt-6 flex-row items-center gap-3 rounded-card border border-border bg-surface p-4">
            <Avatar initials={initialsOf(order.rider.fullName)} size={44} />
            <View className="flex-1">
              <Text className="font-sans-semibold text-[14px] text-ink">{order.rider.fullName}</Text>
              <Text className="text-[12px] text-muted">Your runner</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View className="border-t border-border bg-canvas px-5 pb-11 pt-4">
        <Button
          label="Reorder"
          disabled={!order?.shop}
          onPress={() =>
            order?.shop &&
            navigation.navigate("DescribeOrder", { shopId: order.shop.id, shopName: order.shop.name })
          }
        />
      </View>
    </SafeAreaView>
  );
}
