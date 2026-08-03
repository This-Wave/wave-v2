import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { VerticalTimeline } from "../../components/ui/VerticalTimeline";
import { Button } from "../../components/ui/Button";
import { useOrder } from "../../lib/orders";
import { shortOrderRef } from "./orderPresenters";
import type { OrderStatus } from "../../types";
import type { StepState } from "../../components/ui/HorizontalStepper";

type Route = RouteProp<StudentStackParamList, "OrderTimeline">;

const STAGES: OrderStatus[] = ["confirmed", "rider_assigned", "en_route", "delivered"];

function timeAt(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  return `${date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${date.toLocaleTimeString(
    [],
    { hour: "numeric", minute: "2-digit" },
  )}`;
}

/**
 * v5 screen 10 "Order timeline": a compact order header card, then the squared-dot
 * rail. Completed stages are solid green, the live stage is lime with its detail
 * in green, and everything ahead of it fades to #B7C4AE.
 */
export function OrderTimelineScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId, { poll: true });

  const currentIndex = order
    ? Math.max(
        STAGES.indexOf(order.status === "at_checkpoint" ? "en_route" : order.status),
        order.status === "delivered" ? STAGES.length - 1 : 0,
      )
    : 0;

  function stateFor(index: number): StepState {
    if (index < currentIndex) return "done";
    if (index === currentIndex) return "active";
    return "upcoming";
  }

  const steps = [
    { title: "Order placed", subtitle: timeAt(order?.createdAt), state: stateFor(0) },
    {
      title: order?.rider ? `Runner assigned — ${order.rider.fullName}` : "Runner assigned",
      subtitle: order?.riderId ? timeAt(order.updatedAt) : "Waiting for a runner",
      state: stateFor(1),
    },
    {
      title: `En route to ${order?.checkpoint?.name ?? "your checkpoint"}`,
      subtitle: order?.status === "en_route" ? "On the way now" : undefined,
      state: stateFor(2),
      emphasis: order?.status === "en_route",
    },
    {
      title: "Delivered",
      subtitle: order?.deliveredAt ? timeAt(order.deliveredAt) : "Pending",
      state: stateFor(3),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Order timeline" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-7 flex-row items-center justify-between rounded-card border border-border bg-surface p-3.5">
          <Text className="font-sans-semibold text-[14px] text-ink">Order {shortOrderRef(params.orderId)}</Text>
          <Text className="text-[12px] text-muted" numberOfLines={1}>
            {order?.shop?.name ?? "Shop"} → {order?.checkpoint?.name ?? "Checkpoint"}
          </Text>
        </View>

        <VerticalTimeline steps={steps} />
      </ScrollView>

      <View className="border-t border-border bg-canvas px-5 pb-11 pt-4">
        <Button label="Show pickup PIN" onPress={() => navigation.navigate("PickupPin", { orderId: params.orderId })} />
      </View>
    </SafeAreaView>
  );
}
