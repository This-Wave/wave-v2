import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../../navigation/StudentNavigator";
import {
  Button,
  Chip,
  Empty,
  Gutter,
  ListError,
  ListSkeleton,
  ProgressRail,
  Screen,
  ScreenBody,
  StatusPill,
  Thumb,
} from "../../../components/v6";
import { ChevronRightIcon } from "../../../components/icons";
import { colors } from "../../../theme/tokens";
import { useMyOrders } from "../../../lib/orders";
import { formatGhsCompact } from "../../../lib/pricing";
import { resetToPayment } from "../../../lib/navigationFlows";
import { orderProgress, statusPill } from "../orderPresenters";
import { openOrderDetail, openOrderTracking } from "../../../lib/desktopNavigate";
import type { Order } from "../../../types";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

const LIVE = ["confirmed", "rider_assigned", "en_route", "at_checkpoint"];

/** Desktop orders page — table-style list, not a phone stack. */
export function StudentOrdersWeb() {
  const navigation = useNavigation<Nav>();
  const { data: orders, isLoading, isError, refetch, isRefetching } = useMyOrders();
  const [filter, setFilter] = useState<"all" | "delivered" | "cancelled">("all");

  const live = useMemo(() => (orders ?? []).filter((o) => LIVE.includes(o.status)), [orders]);
  const unpaid = useMemo(
    () => (orders ?? []).filter((o) => o.status === "payment_pending"),
    [orders],
  );
  const past = useMemo(() => {
    const rest = (orders ?? []).filter(
      (o) => !LIVE.includes(o.status) && o.status !== "payment_pending",
    );
    if (filter === "delivered") return rest.filter((o) => o.status === "delivered");
    if (filter === "cancelled")
      return rest.filter((o) => o.status === "cancelled" || o.status === "refunded");
    return rest;
  }, [orders, filter]);

  return (
    <Screen>
      <ScreenBody
        bottomInset={48}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      >
        <Gutter className="pb-8 pt-8">
          <Text className="font-sans-bold text-heading text-ink">Orders</Text>
          <Text className="mt-1 font-sans text-ui text-muted">
            Track live deliveries and review what you’ve already received.
          </Text>
        </Gutter>

        {live.length > 0 ? (
          <Gutter className="mb-10" style={{ gap: 12 }}>
            <Text className="mb-1 font-sans-medium text-heading-sm text-ink">Happening now</Text>
            {live.map((o) => (
              <View
                key={o.id}
                className="flex-row items-center gap-4 rounded-card bg-surface px-5 py-4"
              >
                <Thumb uri={o.shop?.logoUrl} size={52} />
                <View className="min-w-0 flex-1">
                  <View className="mb-1 flex-row items-center gap-2">
                    <Text className="font-sans-medium text-ui text-ink" numberOfLines={1}>
                      {o.shop?.name ?? "Package pickup"}
                    </Text>
                    <StatusPill {...statusPill(o.status)} />
                  </View>
                  <Text className="mb-2 font-sans text-body text-muted" numberOfLines={1}>
                    {o.itemDescription}
                  </Text>
                  <ProgressRail ratio={orderProgress(o.status)} />
                </View>
                <Button
                  label="Track"
                  full={false}
                  onPress={() => openOrderTracking(navigation, o.id)}
                />
              </View>
            ))}
          </Gutter>
        ) : null}

        {unpaid.length > 0 ? (
          <Gutter className="mb-10" style={{ gap: 12 }}>
            <Text className="mb-1 font-sans-medium text-heading-sm text-ink">Waiting for payment</Text>
            {unpaid.map((o) => (
              <View
                key={o.id}
                className="flex-row items-center gap-4 rounded-card bg-surface px-5 py-4"
              >
                <Thumb uri={o.shop?.logoUrl} size={52} />
                <View className="min-w-0 flex-1">
                  <Text className="font-sans-medium text-ui text-ink" numberOfLines={1}>
                    {o.shop?.name ?? "Your order"}
                  </Text>
                  <Text className="font-sans text-body text-muted">
                    {formatGhsCompact(Number(o.totalAmount ?? 0))} · not paid yet
                  </Text>
                </View>
                <Button
                  label="Pay"
                  full={false}
                  onPress={() =>
                    resetToPayment(navigation, {
                      orderId: o.id,
                      totalAmount: Number(o.totalAmount),
                    })
                  }
                />
              </View>
            ))}
          </Gutter>
        ) : null}

        <Gutter className="mb-4">
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
            <Chip
              label="Delivered"
              selected={filter === "delivered"}
              onPress={() => setFilter("delivered")}
            />
            <Chip
              label="Cancelled"
              selected={filter === "cancelled"}
              onPress={() => setFilter("cancelled")}
            />
          </View>
        </Gutter>

        <Gutter>
          {isLoading ? (
            <ListSkeleton rows={5} />
          ) : isError ? (
            <ListError onRetry={() => void refetch()} />
          ) : past.length === 0 ? (
            <Empty
              title="Nothing here yet"
              body={
                filter === "all"
                  ? "Your finished orders will collect here."
                  : "No orders match this filter."
              }
            />
          ) : (
            <View className="overflow-hidden rounded-card bg-surface">
              <View className="flex-row border-b border-hairline px-5 py-3">
                <Text className="flex-[2] font-sans-semibold text-meta text-muted">SHOP</Text>
                <Text className="flex-1 font-sans-semibold text-meta text-muted">DATE</Text>
                <Text className="flex-1 font-sans-semibold text-meta text-muted">TOTAL</Text>
                <Text className="w-28 font-sans-semibold text-meta text-muted">STATUS</Text>
              </View>
              {past.map((o, i) => (
                <PastRow
                  key={o.id}
                  order={o}
                  last={i === past.length - 1}
                  onPress={() => openOrderDetail(navigation, o.id)}
                />
              ))}
            </View>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}

function PastRow({
  order,
  last,
  onPress,
}: {
  order: Order;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center px-5 py-4 active:bg-canvas ${
        last ? "" : "border-b border-hairline"
      }`}
    >
      <View className="flex-[2] flex-row items-center gap-3 pr-3">
        <Thumb uri={order.shop?.logoUrl} size={40} />
        <Text className="flex-1 font-sans-medium text-body text-ink" numberOfLines={1}>
          {order.shop?.name ?? "Package pickup"}
        </Text>
      </View>
      <Text className="flex-1 font-sans text-body text-muted">{dayOf(order)}</Text>
      <Text className="flex-1 font-sans-medium text-body text-ink">
        {formatGhsCompact(Number(order.totalAmount ?? 0))}
      </Text>
      <View className="w-28">
        <StatusPill {...statusPill(order.status)} />
      </View>
      <ChevronRightIcon size={18} color={colors.subtle} strokeWidth={2} />
    </Pressable>
  );
}

function dayOf(order: Order): string {
  const iso = order.deliveredAt ?? order.scheduledDate;
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
