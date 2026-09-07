import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  Button,
  Chip,
  Empty,
  Gutter,
  ListError,
  ListSkeleton,
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
import { openOrderDetail, openOrderTracking } from "../../lib/desktopNavigate";
import { formatGhsCompact } from "../../lib/pricing";
import { resetToPayment } from "../../lib/navigationFlows";
import { orderProgress, statusPill } from "./orderPresenters";
import { StudentOrdersWeb } from "./web/StudentOrdersWeb";
import { useLayout } from "../../hooks/useLayout";
import type { Order } from "../../types";
import { useFeature } from "../../lib/features";
import { describeWave } from "../../lib/wave";
import { isStandardRunDay } from "../../lib/pricing";
import { resetToShopMenu } from "../../lib/navigationFlows";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

const LIVE = ["confirmed", "rider_assigned", "en_route", "at_checkpoint"];

export function OrderHistoryScreen() {
  const { isDesktop } = useLayout();
  if (isDesktop) return <StudentOrdersWeb />;
  return <OrderHistoryMobile />;
}

function OrderHistoryMobile() {
  const navigation = useNavigation<Nav>();
  const { data: orders, isLoading, isError, refetch, isRefetching } = useMyOrders();
  const [filter, setFilter] = useState<"all" | "delivered" | "cancelled">("all");
  const canReorder = useFeature("reorder");

  // Reordering books onto the next open Wave; the calendar is how you pick a
  // different one. Same rule as the order detail screen.
  const nextWave = useMemo(() => {
    const next = describeWave();
    const date = next?.date ?? new Date();
    return { scheduledDate: date.toISOString(), isSpecialOrder: !isStandardRunDay(date) };
  }, []);

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
        bottomInset={24}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      >
        <Gutter className="pb-6 pt-4">
          <PageTitle>Orders</PageTitle>
        </Gutter>

        {live.length > 0 ? (
          <View className="mb-section">
            <Gutter className="mb-3">
              <Text className="font-sans-medium text-subheading text-ink">Happening now</Text>
            </Gutter>
            <Gutter style={{ gap: 12 }}>
              {live.map((o) => (
                <LiveRow key={o.id} order={o} navigation={navigation} />
              ))}
            </Gutter>
          </View>
        ) : null}

        {unpaid.length > 0 ? (
          <View className="mb-section">
            <Gutter className="mb-3">
              <Text className="font-sans-medium text-subheading text-ink">Waiting for payment</Text>
            </Gutter>
            <Gutter style={{ gap: 12 }}>
              {unpaid.map((o) => (
                <View key={o.id} className="rounded-card bg-surface p-4">
                  <View className="mb-3 flex-row items-center gap-3">
                    <Thumb uri={o.shop?.logoUrl} size={44} />
                    <View className="flex-1">
                      <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
                        {o.shop?.name ?? "Your order"}
                      </Text>
                      <Text className="font-sans text-body text-muted" numberOfLines={1}>
                        {formatGhsCompact(Number(o.totalAmount ?? 0))} · not paid yet
                      </Text>
                    </View>
                  </View>
                  <Button
                    label="Pay now"
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
          {isLoading ? (
            <ListSkeleton rows={4} />
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
              action={
                filter === "all" ? (
                  <Button
                    label="Browse shops"
                    variant="ghost"
                    full={false}
                    onPress={() => navigation.navigate("ShopSelection")}
                  />
                ) : undefined
              }
            />
          ) : (
            <RowGroup>
              {past.map((o) =>
                /* A delivered order from a shop gets its own "Order again" beside
                   the row. The action already existed on the order detail screen,
                   which meant opening an order to repeat it — two screens for the
                   thing most students do most often.

                   It still lands on the shop's menu rather than rebuilding the
                   basket, for the reason stated on OrderDetailScreen: prices and
                   stock move between Waves, so a silently rebuilt basket would
                   quote a total the shop may not honour and fail at checkout
                   instead of at the menu. */
                canReorder && o.status === "delivered" && o.shop ? (
                  <View
                    key={o.id}
                    className="flex-row items-center gap-3 rounded-card bg-surface px-4 py-3"
                  >
                    <Pressable
                      onPress={() => openOrderDetail(navigation, o.id)}
                      accessibilityRole="button"
                      accessible
                      accessibilityLabel={`${o.shop.name}, ${dayOf(o)}, ${formatGhsCompact(
                        Number(o.totalAmount ?? 0),
                      )}, ${statusPill(o.status).label}`}
                      className="min-h-[44px] flex-1 flex-row items-center gap-3"
                    >
                      <Thumb uri={o.shop.logoUrl} />
                      <View className="min-w-0 flex-1">
                        <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
                          {o.shop.name}
                        </Text>
                        <Text className="font-sans text-body text-muted" numberOfLines={1}>
                          {dayOf(o)} · {formatGhsCompact(Number(o.totalAmount ?? 0))}
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        resetToShopMenu(navigation, {
                          shopId: o.shop!.id,
                          shopName: o.shop!.name,
                          scheduledDate: nextWave.scheduledDate,
                          isSpecialOrder: nextWave.isSpecialOrder,
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Order from ${o.shop.name} again`}
                      accessibilityHint="Opens the shop's menu for the next Wave"
                      hitSlop={6}
                      className="min-h-[44px] justify-center rounded-pill border border-ink px-4"
                    >
                      <Text className="font-sans-medium text-body text-ink">Order again</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Row
                    key={o.id}
                    title={o.shop?.name ?? "Package pickup"}
                    meta={`${dayOf(o)} · ${formatGhsCompact(Number(o.totalAmount ?? 0))}`}
                    leading={<Thumb uri={o.shop?.logoUrl} />}
                    trailing={<StatusPill {...statusPill(o.status)} />}
                    onPress={() => openOrderDetail(navigation, o.id)}
                  />
                ),
              )}
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
        onPress={() => openOrderTracking(navigation, order.id)}
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
