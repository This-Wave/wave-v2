import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  Empty,
  Gutter,
  ListError,
  ListSkeleton,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Thumb,
} from "../../components/v6";
import { ChevronRightIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { useAuthStore } from "../../store/authStore";
import { useAvailableOrders, useSetAvailability } from "../../lib/rider";
import { useWave } from "../../lib/wave";
import { useLayout } from "../../hooks/useLayout";
import { openRiderClaim } from "../../lib/desktopNavigate";
import { formatGhs } from "../../lib/pricing";
import type { Order } from "../../types";

/**
 * The rider's feed of unclaimed orders, on v6.
 *
 * The fee leads each row — it is the one number a rider decides on — set as the
 * trailing value rather than buried in a coloured corner as it was in v5.
 */
export function OrderFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  // `isAvailable`, not `isActive` — the latter is the ban flag, and reading it
  // here would show a banned rider as "Online" while every request 403s.
  const [online, setOnline] = useState(profile?.isAvailable ?? true);
  const { data: orders, isLoading, isError, refetch, isRefetching } = useAvailableOrders();
  const setAvailability = useSetAvailability();
  const wave = useWave();
  const { isDesktop } = useLayout();

  function handleToggle(value: boolean) {
    setOnline(value);
    setAvailability.mutate(value);
  }

  return (
    <Screen>
      <ScreenBody
        bottomInset={24}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      >
        <Gutter className={isDesktop ? "flex-row items-end justify-between pb-8 pt-8" : "pb-6 pt-4"}>
          <View className="flex-1 pr-4">
            {isDesktop ? (
              <>
                <Text className="font-sans-bold text-heading text-ink">Available</Text>
                <Text className="mt-1 font-sans text-ui text-muted">
                  {wave
                    ? `${wave.name} · closes in ${wave.countdown}. Claim what you can run.`
                    : "Orders for the next Wave land here."}
                </Text>
              </>
            ) : (
              <>
                <PageTitle>Available</PageTitle>
                <Text className="mt-2 font-sans text-body text-muted">
                  {wave ? `${wave.name} · closes in ${wave.countdown}` : "Next Wave"}
                </Text>
              </>
            )}
          </View>
          <View className="items-end gap-1.5">
            <ToggleSwitch
              value={online}
              onValueChange={handleToggle}
              accessibilityLabel={online ? "Available for deliveries" : "Not available for deliveries"}
            />
            <Text className="font-sans text-meta text-muted">{online ? "Online" : "Offline"}</Text>
          </View>
        </Gutter>

        {!online ? (
          <Gutter className="mb-4 rounded-card bg-surface px-4 py-3">
            <Text className="font-sans-medium text-body text-ink">You are offline</Text>
            <Text className="mt-0.5 font-sans text-body text-muted">
              Turn availability on to see and claim new orders.
            </Text>
          </Gutter>
        ) : null}

        <Gutter>
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : isError ? (
            <ListError onRetry={() => void refetch()} />
          ) : !orders || orders.length === 0 ? (
            <Empty
              title="Nothing waiting"
              body={
                online
                  ? "New orders land here as students place them for this Wave."
                  : "You're offline. Turn on availability to receive orders."
              }
            />
          ) : isDesktop ? (
            <View className="overflow-hidden rounded-card bg-surface">
              <View className="flex-row border-b border-hairline px-5 py-3">
                <Text className="flex-[2] font-sans-semibold text-meta text-muted">SHOP</Text>
                <Text className="flex-[2] font-sans-semibold text-meta text-muted">ROUTE</Text>
                <Text className="w-28 font-sans-semibold text-meta text-muted">FEE</Text>
              </View>
              {orders.map((order, i) => (
                <FeedRow
                  key={order.id}
                  order={order}
                  last={i === orders.length - 1}
                  onPress={() => openRiderClaim(navigation, order.id)}
                />
              ))}
            </View>
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
                  onPress={() => openRiderClaim(navigation, order.id)}
                />
              ))}
            </RowGroup>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}

function FeedRow({
  order,
  last,
  onPress,
}: {
  order: Order;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center px-5 py-4 active:bg-canvas ${
        last ? "" : "border-b border-hairline"
      }`}
    >
      <View className="flex-[2] flex-row items-center gap-3 pr-3">
        <Thumb uri={order.shop?.logoUrl} size={40} />
        <Text className="flex-1 font-sans-medium text-body text-ink" numberOfLines={1}>
          {order.shop?.name ?? "Shop"}
        </Text>
      </View>
      <Text className="flex-[2] pr-3 font-sans text-body text-muted" numberOfLines={1}>
        {order.shop?.locationText ?? "Off-campus"} → {order.checkpoint?.name ?? "checkpoint"}
      </Text>
      <Text className="w-28 font-sans-semibold text-body text-ink">
        {formatGhs(Number(order.deliveryFee))}
      </Text>
      <ChevronRightIcon size={18} color={colors.subtle} strokeWidth={2} />
    </Pressable>
  );
}
