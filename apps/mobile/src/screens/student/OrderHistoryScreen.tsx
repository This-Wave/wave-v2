import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Store } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { SearchBar } from "../../components/ui/SearchBar";
import { FilterChip } from "../../components/ui/FilterChip";
import { ListRow } from "../../components/ui/ListRow";
import { Badge } from "../../components/ui/Badge";
import { useMyOrders } from "../../lib/orders";
import { formatGhs } from "../../lib/pricing";
import type { OrderStatus } from "../../types";

const FILTERS = ["All", "Active", "Delivered", "Cancelled"] as const;
type Filter = (typeof FILTERS)[number];

const ACTIVE_STATUSES: OrderStatus[] = ["pending", "payment_pending", "confirmed", "rider_assigned", "en_route", "at_checkpoint"];

function statusBadge(status: OrderStatus): { label: string; variant: "success" | "error" | "neutral"; pulse?: boolean } {
  if (status === "delivered") return { label: "Delivered", variant: "success" };
  if (status === "cancelled" || status === "refunded") return { label: status === "refunded" ? "Refunded" : "Cancelled", variant: "error" };
  if (status === "en_route") return { label: "En Route", variant: "success", pulse: true };
  return { label: status.replace(/_/g, " "), variant: "neutral" };
}

export function OrderHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { data: orders } = useMyOrders();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    return (orders ?? []).filter((order) => {
      if (filter === "Active" && !ACTIVE_STATUSES.includes(order.status)) return false;
      if (filter === "Delivered" && order.status !== "delivered") return false;
      if (filter === "Cancelled" && !["cancelled", "refunded"].includes(order.status)) return false;
      if (query && !order.shop?.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [orders, filter, query]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="gap-3 px-6 pb-3.5 pt-3">
        <Text className="font-sans-extrabold text-[17px] tracking-tight text-ink">Orders</Text>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search orders..." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <FilterChip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView className="flex-1 px-6">
        {filtered.length === 0 ? (
          <Text className="mt-4 text-center text-[12px] text-muted">No orders yet.</Text>
        ) : (
          filtered.map((order) => (
            <View key={order.id} className="mb-2.5 overflow-hidden rounded-well border border-border">
              <ListRow
                leading={
                  <View className="h-11 w-11 items-center justify-center rounded-well bg-surface-muted">
                    <Store size={18} color="#9E9E9E" />
                  </View>
                }
                title={order.shop?.name ?? "Shop"}
                subtitle={formatGhs(Number(order.totalAmount))}
                trailing={<Badge {...statusBadge(order.status)} />}
                onPress={() => navigation.navigate("OrderTracking", { orderId: order.id })}
              />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
