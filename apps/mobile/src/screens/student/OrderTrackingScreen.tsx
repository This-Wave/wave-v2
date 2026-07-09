import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, MapPin } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { VerticalTimeline } from "../../components/ui/VerticalTimeline";
import { useOrder } from "../../lib/orders";
import type { StepState } from "../../components/ui/HorizontalStepper";
import type { OrderStatus } from "../../types";

type Route = RouteProp<StudentStackParamList, "OrderTracking">;

const TIMELINE_ORDER: OrderStatus[] = ["confirmed", "rider_assigned", "en_route", "at_checkpoint"];
const TIMELINE_LABELS = ["Order Confirmed", "Rider Assigned", "En Route to Checkpoint", "At Checkpoint"];

function timelineSteps(status: OrderStatus, riderName?: string): { title: string; subtitle?: string; state: StepState }[] {
  const currentIndex = TIMELINE_ORDER.indexOf(status);
  return TIMELINE_LABELS.map((title, i) => ({
    title,
    subtitle: i === 1 && riderName ? riderName : i === 2 && i === currentIndex ? "est. 12 min" : undefined,
    state: i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming",
  }));
}

export function OrderTrackingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId, { poll: true });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center gap-3 px-6 pb-3.5 pt-1.5">
        <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} compact />
        <Text className="flex-1 font-sans-extrabold text-[16px] tracking-tight text-ink" numberOfLines={1}>
          #WV-{params.orderId.slice(0, 8).toUpperCase()}
        </Text>
        {order ? (
          <Badge
            label={order.status.replace(/_/g, " ")}
            variant={order.status === "en_route" ? "success" : "neutral"}
            pulse={order.status === "en_route"}
          />
        ) : null}
      </View>

      <View className="mx-6 mb-4 h-40 items-center justify-center rounded-card bg-surface-muted">
        <MapPin size={22} color="#9E9E9E" />
        <Text className="mt-1.5 text-[11px] text-muted">{order?.checkpoint?.name ?? "Checkpoint"}</Text>
      </View>

      <ScrollView className="flex-1 px-6">
        <Text className="mb-3 font-sans-bold text-[13px] text-ink">Status</Text>
        {order ? <VerticalTimeline steps={timelineSteps(order.status, order.rider?.fullName)} /> : null}
      </ScrollView>

      <View className="px-6 pb-6">
        <Button label="Contact Rider" variant="secondary" onPress={() => {}} disabled={!order?.riderId} />
      </View>
    </SafeAreaView>
  );
}
