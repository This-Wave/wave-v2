import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { Avatar } from "../../components/ui/Avatar";
import { ImagePlaceholder } from "../../components/ui/ImagePlaceholder";
import { MessageIcon, PhoneIcon } from "../../components/icons";
import { useOrder } from "../../lib/orders";
import { initialsOf, shortOrderRef, statusBadge } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "OrderTracking">;

/**
 * v5 screen 09. Map slot, a status pill / ETA row, the runner card with its
 * message + call pair, the pickup→drop-off rail, and the order contents.
 */
export function OrderTrackingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId, { poll: true });

  const rider = order?.rider;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title={`Order ${shortOrderRef(params.orderId)}`} onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-[18px]" contentContainerStyle={{ paddingBottom: 24 }}>
        <ImagePlaceholder height={220} radius={24} style={{ marginBottom: 16 }} />

        <View className="mb-4 flex-row items-center justify-between">
          {order ? <Badge {...statusBadge(order.status)} /> : <View />}
          <Text className="text-[13px] text-muted">
            {order?.status === "en_route" ? "Arriving soon" : "Scheduled run"}
          </Text>
        </View>

        <View className="mb-3.5 flex-row items-center justify-between rounded-card border border-border bg-surface p-4">
          <View className="flex-1 flex-row items-center gap-3">
            {rider ? (
              <Avatar initials={initialsOf(rider.fullName)} size={44} />
            ) : (
              <View className="h-11 w-11 rounded-control bg-canvas" />
            )}
            <View className="flex-1">
              <Text className="font-sans-semibold text-[14px] text-ink" numberOfLines={1}>
                {rider?.fullName ?? "Awaiting a runner"}
              </Text>
              <Text className="text-[12px] text-muted">
                {rider ? "Wave Runner" : "We'll assign one before the run"}
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <IconButton>
              <MessageIcon />
            </IconButton>
            <IconButton filled>
              <PhoneIcon />
            </IconButton>
          </View>
        </View>

        <View className="mb-3.5 flex-row items-center justify-between rounded-card border border-border bg-surface p-[18px]">
          <View>
            <Text className="mb-1 text-[13px] text-muted">{order?.shop?.name ?? "Shop"}</Text>
            <Text className="text-[12px] text-muted">
              {order && ["en_route", "at_checkpoint", "delivered"].includes(order.status) ? "Picked up" : "Pending"}
            </Text>
          </View>
          <View className="mx-3 h-px flex-1 bg-wave-500" />
          <View className="items-end">
            <Text className="mb-1 font-sans-semibold text-[13px] text-ink">
              {order?.checkpoint?.name ?? "Checkpoint"}
            </Text>
            <Text className="text-[12px] text-muted">
              {order?.deliveredAt
                ? new Date(order.deliveredAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                : "On the run"}
            </Text>
          </View>
        </View>

        <View className="rounded-card border border-border bg-surface p-4">
          <Text className="mb-2.5 font-sans-semibold text-[12px] uppercase tracking-[0.6px] text-muted">
            What&apos;s in this order
          </Text>
          <Text className="text-[14px] leading-[22px] text-ink">{order?.itemDescription ?? "—"}</Text>
        </View>
      </ScrollView>

      <View className="border-t border-border bg-canvas px-5 pb-11 pt-4">
        <Button
          label="View full timeline"
          variant="secondary"
          size="compact"
          onPress={() => navigation.navigate("OrderTimeline", { orderId: params.orderId })}
        />
      </View>
    </SafeAreaView>
  );
}
