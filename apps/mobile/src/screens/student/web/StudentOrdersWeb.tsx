import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../../navigation/StudentNavigator";
import { Button, Chip, Empty, ListError, ListSkeleton, StatusPill } from "../../../components/v6";
import { useDeliveryPin, useMyOrders } from "../../../lib/orders";
import { formatGhsCompact } from "../../../lib/pricing";
import { resetToPayment } from "../../../lib/navigationFlows";
import { statusPill, trackerSteps } from "../orderPresenters";
import { openOrderTracking } from "../../../lib/desktopNavigate";
import { CodeTicket, RouteLine } from "../../../components/v7/Signature";
import { Illustration } from "../../../components/v7/Illustration";
import { orderRoute, orderTitle } from "../../../components/v7/OrderCards";
import { localPhone } from "../../../components/v7/InfoRows";
import type { Order } from "../../../types";

type Nav = NativeStackNavigationProp<StudentStackParamList>;
const LIVE = ["confirmed", "rider_assigned", "en_route", "at_checkpoint"];

/**
 * v7 canvas "Web orders": the list on the left (All / Active / Past), the
 * chosen order on the right with its route, code and progress. No page change
 * to look at an order.
 */
export function StudentOrdersWeb() {
  const navigation = useNavigation<Nav>();
  const { data: orders, isLoading, isError, refetch } = useMyOrders();
  const [filter, setFilter] = useState<"all" | "active" | "past">("all");
  const [picked, setPicked] = useState<string | null>(null);

  const list = useMemo(() => {
    const all = orders ?? [];
    if (filter === "active") return all.filter((o) => LIVE.includes(o.status) || o.status === "payment_pending");
    if (filter === "past") return all.filter((o) => !LIVE.includes(o.status) && o.status !== "payment_pending");
    return all;
  }, [orders, filter]);
  const selected = list.find((o) => o.id === picked) ?? list[0] ?? null;

  return (
    <View className="flex-1 flex-row bg-canvas" style={{ marginHorizontal: -28 }}>
      <View className="border-r border-hairline" style={{ width: 420, paddingHorizontal: 28, paddingTop: 40 }}>
        <Text accessibilityRole="header" className="font-display text-ink" style={{ fontSize: 48, lineHeight: 54 }}>
          Orders
        </Text>
        <View className="mb-4 mt-4 flex-row" style={{ gap: 8 }}>
          <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
          <Chip label="Active" selected={filter === "active"} onPress={() => setFilter("active")} />
          <Chip label="Past" selected={filter === "past"} onPress={() => setFilter("past")} />
        </View>
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : isError ? (
          <ListError onRetry={() => void refetch()} />
        ) : list.length === 0 ? (
          <Empty title="Nothing here" body="Your orders show up here." />
        ) : (
          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 28 }}>
            {list.map((o) => {
              const on = selected?.id === o.id;
              const pill = statusPill(o.status, !!o.companyId);
              const when = o.status === "delivered" ? (o.deliveredAt ?? o.scheduledDate) : null;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setPicked(o.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${orderTitle(o)}, ${pill.label}`}
                  className={`flex-row items-center rounded-card border-2 px-4 py-3.5 ${on ? "border-ink bg-wash" : "border-line bg-surface"}`}
                  style={{ gap: 12 }}
                >
                  <View className="min-w-0 flex-1">
                    <Text className="font-sans-bold text-ui text-ink" numberOfLines={1}>{orderTitle(o)}</Text>
                    <Text className="font-sans text-meta text-muted" numberOfLines={1}>
                      {[orderRoute(o), when ? new Date(when).toLocaleDateString([], { day: "numeric", month: "short" }) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Text className="font-sans-bold text-meta text-ink-700">{o.status === "payment_pending" ? "Not paid" : pill.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View className="flex-1" style={{ paddingHorizontal: 48, paddingTop: 40 }}>
        {selected ? (
          <OrderPane order={selected} navigation={navigation} />
        ) : !isLoading ? (
          <View className="flex-1 items-center justify-center" style={{ gap: 12 }}>
            <Illustration name="pillow" width={240} height={170} />
            <Text className="font-display text-heading text-ink">No orders yet</Text>
            <Button label="Send a package" full={false} onPress={() => navigation.navigate("PickupRequest")} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function OrderPane({ order, navigation }: { order: Order; navigation: Nav }) {
  const pill = statusPill(order.status, !!order.companyId);
  const live = LIVE.includes(order.status);
  const { data: pin } = useDeliveryPin(live && !order.companyId ? order.id : undefined);
  const steps = trackerSteps(order);
  const size = order.packageSize ? `${order.packageSize[0]!.toUpperCase()}${order.packageSize.slice(1)} size` : null;
  const when = order.deliveredAt
    ? `collected ${new Date(order.deliveredAt).toLocaleDateString([], { day: "numeric", month: "short" })}`
    : order.scheduledDate
      ? `arrives ${new Date(order.scheduledDate).toLocaleDateString([], { weekday: "long" })}`
      : null;

  return (
    <View style={{ gap: 20 }}>
      <View>
        <StatusPill label={order.status === "payment_pending" ? "Not paid" : pill.label} tone={pill.tone} />
        <Text accessibilityRole="header" className="mt-3 font-display text-ink" style={{ fontSize: 44, lineHeight: 50 }}>
          {orderTitle(order)}
        </Text>
        <Text className="mt-1 font-sans text-ui text-muted">{[size, when].filter(Boolean).join(" · ")}</Text>
      </View>

      <View className="flex-row" style={{ gap: 20 }}>
        <View className="flex-1 rounded-card border border-hairline bg-surface p-5">
          <RouteLine
            fromLabel="From"
            from={
              order.orderType === "pickup"
                ? [order.senderName, order.originCheckpoint?.name?.split(" & ")[0]].filter(Boolean).join(", ") || "Accra"
                : (order.shop?.name ?? "The shop")
            }
            fromSub={localPhone(order.senderPhone)}
            toLabel="To you at"
            to={order.checkpoint?.name ?? "your pickup point"}
          />
        </View>
        {live && pin ? (
          <View className="flex-1">
            <CodeTicket pin={pin} />
          </View>
        ) : null}
      </View>

      <View className="flex-row" style={{ gap: 8 }}>
        {steps.map((s) => (
          <View key={s.label} className="flex-1" style={{ gap: 8 }}>
            <View className={`h-1.5 rounded-pill ${s.done ? "bg-lime" : "bg-hairline"}`} />
            <Text className={`font-sans text-meta ${s.done ? "font-sans-bold text-ink" : "text-muted"}`}>
              {s.label.replace(/^Picked up in .*/, "Picked up")}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row" style={{ gap: 10 }}>
        {order.status === "payment_pending" ? (
          <Button
            label={`Pay ${formatGhsCompact(Number(order.totalAmount ?? 0))}`}
            full={false}
            onPress={() => resetToPayment(navigation, { orderId: order.id, totalAmount: Number(order.totalAmount) })}
          />
        ) : live ? (
          <Button label="Track" full={false} onPress={() => openOrderTracking(navigation, order.id)} />
        ) : order.orderType === "pickup" ? (
          <Button
            label="Send again"
            full={false}
            onPress={() =>
              navigation.navigate("PickupRequest", {
                fromId: order.originCheckpointId ?? undefined,
                toId: order.checkpointId ?? undefined,
                senderName: order.senderName ?? undefined,
                senderPhone: order.senderPhone ?? undefined,
              })
            }
          />
        ) : null}
      </View>
    </View>
  );
}
