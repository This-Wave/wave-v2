import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  Chip,
  Empty,
  Gutter,
  PageTitle,
  ProgressRail,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  StatusPill,
  Thumb,
} from "../../components/v6";
import { useMyOrders } from "../../lib/orders";
import { formatGhsCompact } from "../../lib/pricing";
import { orderProgress, statusPill } from "./orderPresenters";
import type { Order } from "../../types";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

const LIVE = ["confirmed", "rider_assigned", "en_route", "at_checkpoint"];

/**
 * Orders, rebuilt.
 *
 * v5 showed one flat list filtered by order *type* — "All / Buy For Me /
 * Pickup" — which is a distinction a student rarely cares about after the fact.
 * The useful split is by whether the order is still happening, so live orders
 * are pulled out of the list entirely and given a progress rail.
 */
export function OrderHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { data: orders, isLoading } = useMyOrders();
  const [filter, setFilter] = useState<"all" | "delivered" | "cancelled">("all");

  const live = useMemo(() => (orders ?? []).filter((o) => LIVE.includes(o.status)), [orders]);
  const past = useMemo(() => {
    const rest = (orders ?? []).filter((o) => !LIVE.includes(o.status));
    if (filter === "delivered") return rest.filter((o) => o.status === "delivered");
    if (filter === "cancelled")
      return rest.filter((o) => o.status === "cancelled" || o.status === "refunded");
    return rest;
  }, [orders, filter]);

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-6 pt-4">
          <PageTitle>Orders</PageTitle>
        </Gutter>

        {live.length > 0 ? (
          <View className="mb-section">
            <Gutter className="mb-3">
              <Text className="font-sans-medium text-subheading text-ink">Happening now</Text>
            </Gutter>
            <Gutter className="gap-2">
              {live.map((o) => (
                <LiveRow key={o.id} order={o} navigation={navigation} />
              ))}
            </Gutter>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
          className="mb-4 grow-0"
        >
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
        </ScrollView>

        <Gutter>
          {isLoading ? null : past.length === 0 ? (
            <Empty
              title="Nothing here yet"
              body={
                filter === "all"
                  ? "Your finished orders will collect here."
                  : "No orders match this filter."
              }
            />
          ) : (
            <RowGroup>
              {past.map((o) => (
                <Row
                  key={o.id}
                  title={o.shop?.name ?? "Package pickup"}
                  meta={`${dayOf(o)} · ${formatGhsCompact(Number(o.totalAmount ?? 0))}`}
                  leading={<Thumb uri={o.shop?.logoUrl} />}
                  trailing={<StatusPill {...statusPill(o.status)} />}
                  onPress={() => navigation.navigate("OrderDetail", { orderId: o.id })}
                />
              ))}
            </RowGroup>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}

function LiveRow({ order, navigation }: { order: Order; navigation: Nav }) {
  const pill = statusPill(order.status);
  return (
    <View className="rounded-card bg-surface p-4">
      <View className="mb-3 flex-row items-center gap-3">
        <Thumb uri={order.shop?.logoUrl} size={44} />
        <View className="flex-1">
          <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
            {order.shop?.name ?? "Your order"}
          </Text>
          <Text className="font-sans text-body text-muted" numberOfLines={1}>
            {order.itemDescription}
          </Text>
        </View>
        <StatusPill label={pill.label} tone={pill.tone} />
      </View>
      <ProgressRail ratio={orderProgress(order.status)} />
      <Text
        className="pt-3 font-sans-medium text-body text-ink"
        accessibilityRole="button"
        onPress={() => navigation.navigate("OrderTracking", { orderId: order.id })}
      >
        Track this order
      </Text>
    </View>
  );
}

function dayOf(order: Order): string {
  const iso = order.deliveredAt ?? order.scheduledDate;
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}
