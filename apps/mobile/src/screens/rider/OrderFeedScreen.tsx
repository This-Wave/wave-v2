import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  Empty,
  Gutter,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Skeleton,
  Thumb,
} from "../../components/v6";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { useAuthStore } from "../../store/authStore";
import { useAvailableOrders, useSetAvailability } from "../../lib/rider";
import { useWave } from "../../lib/wave";
import { formatGhs } from "../../lib/pricing";

/**
 * The rider's feed of unclaimed orders, on v6.
 *
 * The fee leads each row — it is the one number a rider decides on — set as the
 * trailing value rather than buried in a coloured corner as it was in v5.
 */
export function OrderFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const [online, setOnline] = useState(profile?.isActive ?? true);
  const { data: orders, isLoading } = useAvailableOrders();
  const setAvailability = useSetAvailability();
  const wave = useWave();

  function handleToggle(value: boolean) {
    setOnline(value);
    setAvailability.mutate(value);
  }

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-6 pt-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <PageTitle>Available</PageTitle>
              <Text className="mt-2 font-sans text-body text-muted">
                {wave ? `${wave.name} · closes in ${wave.countdown}` : "Next Wave"}
              </Text>
            </View>
            <View className="items-end gap-1.5">
              <ToggleSwitch value={online} onValueChange={handleToggle} />
              <Text className="font-sans text-meta text-muted">{online ? "Online" : "Offline"}</Text>
            </View>
          </View>
        </Gutter>

        <Gutter>
          {isLoading ? (
            <View className="gap-2">
              <Skeleton height={72} radius={12} />
              <Skeleton height={72} radius={12} />
            </View>
          ) : !orders || orders.length === 0 ? (
            <Empty
              title="Nothing waiting"
              body={
                online
                  ? "New orders land here as students place them for this Wave."
                  : "You're offline. Turn on availability to receive orders."
              }
            />
          ) : (
            <RowGroup>
              {orders.map((order) => (
                <Row
                  key={order.id}
                  title={order.shop?.name ?? "Shop"}
                  meta={`${order.shop?.locationText ?? "Off-campus"} → ${order.checkpoint?.name ?? "checkpoint"}`}
                  leading={<Thumb uri={order.shop?.logoUrl} />}
                  trailing={
                    <Text className="font-sans-semibold text-body text-ink">
                      {formatGhs(Number(order.deliveryFee))}
                    </Text>
                  }
                  onPress={() => navigation.navigate("OrderDetail", { orderId: order.id })}
                />
              ))}
            </RowGroup>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
