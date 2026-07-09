import { useMemo } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Bell, PackageCheck, ShoppingBag, Store } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { CountdownCard } from "../../components/ui/CountdownCard";
import { ServiceCard } from "../../components/ui/ServiceCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { HorizontalStepper, type StepState } from "../../components/ui/HorizontalStepper";
import { ListRow } from "../../components/ui/ListRow";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuthStore } from "../../store/authStore";
import { useMyOrders } from "../../lib/orders";
import { formatFullDay, formatGhs, isCutoffPassedToday, nextRunCutoff } from "../../lib/pricing";
import type { Order, OrderStatus } from "../../types";

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "payment_pending",
  "confirmed",
  "rider_assigned",
  "en_route",
  "at_checkpoint",
];

const STEP_ORDER: OrderStatus[] = ["confirmed", "rider_assigned", "en_route", "at_checkpoint"];
const STEP_LABELS = ["Confirmed", "Assigned", "En Route", "Checkpoint"];

function stepsFor(status: OrderStatus): { label: string; state: StepState }[] {
  const currentIndex = STEP_ORDER.indexOf(status);
  return STEP_LABELS.map((label, i) => ({
    label,
    state: i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming",
  }));
}

function statusBadge(status: OrderStatus): { label: string; variant: "success" | "error" | "neutral"; pulse?: boolean } {
  if (status === "delivered") return { label: "Delivered", variant: "success" };
  if (status === "cancelled" || status === "refunded") return { label: status === "refunded" ? "Refunded" : "Cancelled", variant: "error" };
  if (status === "en_route") return { label: "En Route", variant: "success", pulse: true };
  return { label: status.replace(/_/g, " "), variant: "neutral" };
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: orders, isLoading } = useMyOrders();

  const cutoff = useMemo(() => nextRunCutoff(), []);
  const activeOrder = orders?.find((o) => ACTIVE_STATUSES.includes(o.status));
  const recentOrders = orders?.filter((o) => !ACTIVE_STATUSES.includes(o.status)).slice(0, 2) ?? [];

  function handleBuyForMe() {
    if (isCutoffPassedToday()) {
      navigation.navigate("CutoffPassed");
      return;
    }
    navigation.navigate("ShopSelection");
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-muted">
        <View className="gap-3 px-4 pt-2">
          <View className="flex-row items-center justify-between py-2">
            <View className="gap-1.5">
              <Skeleton width={80} height={12} />
              <Skeleton width={140} height={20} />
            </View>
            <Skeleton width={40} height={40} radius={12} />
          </View>
          <Skeleton height={62} radius={14} />
          <View className="flex-row gap-2.5">
            <Skeleton height={110} radius={14} className="flex-1" />
            <Skeleton height={110} radius={14} className="flex-1" />
          </View>
          <Skeleton width={100} height={13} radius={6} />
          <Skeleton height={100} radius={14} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="flex-row items-center justify-between px-6 pb-3 pt-1">
        <View>
          <Text className="text-[12px] font-sans-medium text-muted">Good morning</Text>
          <Text className="font-sans-extrabold text-[20px] tracking-tight text-ink">
            {profile?.fullName ?? "Student"}
          </Text>
        </View>
        <View className="relative h-10 w-10 items-center justify-center rounded-well border border-border bg-surface">
          <Bell size={19} color="#1A1A1A" strokeWidth={2} />
          <View className="absolute right-[7px] top-[7px] h-2 w-2 rounded-full border-[1.5px] border-surface-muted bg-danger-text" />
        </View>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
        <CountdownCard
          dayLabel={formatFullDay(cutoff)}
          cutoffAt={cutoff}
          closesAtLabel="Closes at 12:00 noon"
        />

        <View className="flex-row gap-2.5">
          <ServiceCard
            icon={ShoppingBag}
            iconBgClass="bg-success-bg"
            iconColor="#2EA64E"
            title="Buy For Me"
            description={"Rider shops\nfor you"}
            actionLabel="Order now"
            onPress={handleBuyForMe}
          />
          <ServiceCard
            icon={PackageCheck}
            iconBgClass="bg-surface-muted"
            iconColor="#555555"
            title="Pickup"
            description={"Collect your\nitem on campus"}
            actionLabel="Request"
            onPress={() => navigation.navigate("PickupRequest")}
          />
        </View>

        {activeOrder ? (
          <View>
            <SectionHeader
              label="Active Orders"
              actionLabel="See all"
              onActionPress={() => navigation.navigate("Tabs", { screen: "Orders" })}
            />
            <Card>
              <View className="mb-2.5 flex-row items-start justify-between">
                <View>
                  <Text className="mb-0.5 font-sans-bold text-[13px] text-ink">
                    {activeOrder.shop?.name ?? "Shop"}
                  </Text>
                  <Text className="text-[11px] text-muted" numberOfLines={1}>
                    {activeOrder.itemDescription} · {activeOrder.checkpoint?.name ?? "Checkpoint"}
                  </Text>
                </View>
                <Badge {...statusBadge(activeOrder.status)} />
              </View>
              <HorizontalStepper steps={stepsFor(activeOrder.status)} />
            </Card>
          </View>
        ) : null}

        <View>
          <SectionHeader
            label="Recent"
            actionLabel="History"
            onActionPress={() => navigation.navigate("Tabs", { screen: "Orders" })}
          />
          <View className="overflow-hidden rounded-well border border-border bg-surface">
            {recentOrders.length === 0 ? (
              <View className="p-4">
                <Text className="text-[12px] text-muted">No past orders yet.</Text>
              </View>
            ) : (
              recentOrders.map((order: Order, i) => (
                <ListRow
                  key={order.id}
                  bordered={i < recentOrders.length - 1}
                  leading={
                    <View className="h-[34px] w-[34px] items-center justify-center rounded-well bg-surface-muted">
                      <Store size={15} color="#9E9E9E" />
                    </View>
                  }
                  title={order.shop?.name ?? "Shop"}
                  subtitle={formatGhs(Number(order.totalAmount))}
                  trailing={<Badge {...statusBadge(order.status)} />}
                  onPress={() => navigation.navigate("OrderTracking", { orderId: order.id })}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
