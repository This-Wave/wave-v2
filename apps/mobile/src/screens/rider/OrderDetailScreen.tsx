import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Button } from "../../components/ui/Button";
import { FieldLabel } from "../../components/ui/FieldLabel";
import { HistoryIcon, PinIcon, UserIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
import { useOrder } from "../../lib/orders";
import { useAcceptOrder } from "../../lib/rider";
import { formatGhs } from "../../lib/pricing";

type Route = RouteProp<RiderStackParamList, "OrderDetail">;

function MetaRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      {icon}
      <Text className="flex-1 text-[14px] text-ink">{label}</Text>
    </View>
  );
}

export function OrderDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const acceptOrder = useAcceptOrder();

  async function handleAccept() {
    await acceptOrder.mutateAsync(params.orderId);
    navigation.replace("ActiveDelivery", { orderId: params.orderId });
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Order detail" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <View className="rounded-card border border-border bg-surface p-[18px]" style={shadowCard}>
          <Text className="font-sans-semibold text-[16px] text-ink">{order?.shop?.name ?? "Shop"}</Text>
          <Text className="mb-4 mt-0.5 text-[11px] text-muted">
            {order?.shop?.locationText ?? "Off-campus"}
          </Text>
          <FieldLabel>Items to buy</FieldLabel>
          <Text className="text-[14px] leading-[22px] text-ink">{order?.itemDescription ?? "—"}</Text>
        </View>

        <View className="gap-3.5 rounded-card border border-border bg-surface p-[18px]" style={shadowCard}>
          <MetaRow
            icon={<UserIcon size={16} color={colors.muted} strokeWidth={1.7} />}
            label={order?.student?.fullName ?? "Student"}
          />
          <MetaRow
            icon={<PinIcon size={16} color={colors.muted} strokeWidth={1.7} />}
            label={order?.checkpoint?.name ?? "Checkpoint"}
          />
          <MetaRow
            icon={<HistoryIcon size={16} color={colors.muted} strokeWidth={1.7} />}
            label={`${order?.deliveryDay ?? "—"} run`}
          />
        </View>

        <View className="rounded-card bg-wave-lime p-[18px]">
          <Text className="mb-1 font-sans-medium text-[12px] text-wave-500">Your earnings</Text>
          <Text className="font-sans-semibold text-[32px] leading-[32px] tracking-tight text-wave-500">
            {order ? formatGhs(Number(order.deliveryFee)) : "—"}
          </Text>
        </View>
      </ScrollView>

      <View className="flex-row gap-3 px-5 pb-7 pt-3">
        <View className="flex-1">
          <Button label="Pass" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
        <View className="flex-[2]">
          <Button label="Accept order" onPress={handleAccept} loading={acceptOrder.isPending} />
        </View>
      </View>
    </SafeAreaView>
  );
}
