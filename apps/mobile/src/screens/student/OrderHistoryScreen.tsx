import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { FilterChip } from "../../components/ui/FilterChip";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";
import { ImagePlaceholder } from "../../components/ui/ImagePlaceholder";
import { BoxIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
import { useMyOrders } from "../../lib/orders";
import { formatGhs } from "../../lib/pricing";
import { statusBadge } from "./orderPresenters";
import type { Order } from "../../types";

const FILTERS = ["All", "Buy For Me", "Pickup"] as const;
type Filter = (typeof FILTERS)[number];

function formatWhen(order: Order): string {
  const date = new Date(order.scheduledDate);
  return date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

/**
 * v5 screen 12 "Order history": a 24px page title, the three-way filter rail,
 * then elevated 24px order rows. Falls back to screen 18's empty state.
 */
export function OrderHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { data: orders } = useMyOrders();
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    return (orders ?? []).filter((order) => {
      // Wave models pickups as orders without a shop; everything else is Buy For Me.
      if (filter === "Pickup") return !order.shop;
      if (filter === "Buy For Me") return !!order.shop;
      return true;
    });
  }, [orders, filter]);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="px-5 pb-4">
        <Text className="mb-3.5 font-sans-semibold text-[24px] tracking-tight text-ink">Order history</Text>
        <View className="flex-row gap-2">
          {FILTERS.map((f) => (
            <FilterChip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          art={<BoxIcon size={34} color={colors.muted} strokeWidth={1.6} />}
          title="No orders yet"
          description="Once you place a Buy For Me or Pickup request, it'll show up here."
        >
          <Button label="Start an order" onPress={() => navigation.navigate("ShopSelection")} />
        </EmptyState>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 128 }}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((order) => (
            <Pressable
              key={order.id}
              className="mb-3 flex-row items-center gap-3 rounded-card border border-border bg-surface p-3.5"
              style={shadowCard}
              onPress={() => navigation.navigate("OrderDetail", { orderId: order.id })}
            >
              {order.shop ? (
                <ImagePlaceholder uri={order.shop.logoUrl} width={44} height={44} radius={14} />
              ) : (
                <View className="h-11 w-11 items-center justify-center rounded-tile bg-canvas">
                  <BoxIcon size={18} color={colors.ink} strokeWidth={1.6} />
                </View>
              )}
              <View className="flex-1">
                <Text className="font-sans-semibold text-[14px] text-ink" numberOfLines={1}>
                  {order.shop ? `${order.shop.name} · Buy For Me` : "Package pickup"}
                </Text>
                <Text className="text-[12px] text-muted">
                  {formatWhen(order)} · {formatGhs(Number(order.totalAmount))}
                </Text>
              </View>
              <Badge {...statusBadge(order.status)} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
