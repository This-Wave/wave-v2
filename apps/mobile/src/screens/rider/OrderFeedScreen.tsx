import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  ActiveDeliveryCard,
  GreetingHeader,
  Empty,
  Gutter,
  ListError,
  ListSkeleton,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Switch,
  Thumb,
} from "../../components/v6";
import { ChevronRightIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useAuthStore } from "../../store/authStore";
import { useAvailableOrders, useMyDeliveries, useSetAvailability } from "../../lib/rider";
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
  // The run they are already on, so the feed never hides it behind the list.
  const { data: myDeliveries } = useMyDeliveries();
  const activeRun = (myDeliveries ?? []).find((o) =>
    ["rider_assigned", "en_route", "at_checkpoint"].includes(o.status),
  );
  const {
    data: orders,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useAvailableOrders({ enabled: online });
  const setAvailability = useSetAvailability();
  const wave = useWave();
  const { isDesktop } = useLayout();

  // Desktop has its own "Available" page heading, so the section label would be
  // a second one.
  const showHeading = !isDesktop && online && !!orders && orders.length > 0;

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
        {isDesktop ? (
          <Gutter className="flex-row items-end justify-between pb-8 pt-8">
            <View className="flex-1 pr-4">
              <Text className="font-sans-bold text-heading text-ink">Available</Text>
              <Text className="mt-1 font-sans text-ui text-muted">
                {wave
                  ? `${wave.name} · closes in ${wave.countdown}. Claim what you can run.`
                  : "Orders for the next Wave land here."}
              </Text>
            </View>
            <View className="items-end gap-1.5">
              <Switch
                value={online}
                onValueChange={handleToggle}
                accessibilityLabel="Available for deliveries"
                accessibilityHint="Turn off to stop new orders appearing in your feed"
              />
              <Text className="font-sans text-meta text-muted">{online ? "Online" : "Offline"}</Text>
            </View>
          </Gutter>
        ) : (
          /* Going online is the rider's first move of the day, so it sits in
             the panel where the student's "Send a package" sits. */
          <GreetingHeader
            name={profile?.fullName ?? "there"}
            avatarUrl={profile?.avatarUrl}
            alert={!!activeRun}
            onPressAvatar={() => navigation.navigate("Tabs", { screen: "Profile" })}
            onPressBell={() => navigation.navigate("Tabs", { screen: "MyOrders" })}
          >
            <View className="flex-row items-center gap-3 rounded-card bg-surface px-4 py-3.5">
              <View className="min-w-0 flex-1">
                <Text className="font-sans-medium text-ui text-ink">
                  {online ? "You're online" : "You're offline"}
                </Text>
                <Text className="font-sans text-body text-muted" numberOfLines={1}>
                  {online
                    ? (wave ? `${wave.name} · closes in ${wave.countdown}` : "Next Wave")
                    : "Turn on to see and claim orders"}
                </Text>
              </View>
              <Switch
                value={online}
                onValueChange={handleToggle}
                accessibilityLabel="Available for deliveries"
                accessibilityHint="Turn off to stop new orders appearing in your feed"
              />
            </View>
          </GreetingHeader>
        )}

        {activeRun ? (
          <Gutter className="pt-5">
            <Text className="mb-3 font-sans-medium text-heading-sm text-ink">On this run</Text>
            <ActiveDeliveryCard
              order={activeRun}
              title={activeRun.shop?.name ?? "Package pickup"}
              trailing={formatGhs(Number(activeRun.deliveryFee))}
              onPress={() => navigation.navigate("ActiveDelivery", { orderId: activeRun.id })}
            />
          </Gutter>
        ) : null}

        {showHeading ? (
          <Gutter className="pt-6">
            <Text className="mb-3 font-sans-medium text-heading-sm text-ink">Available to claim</Text>
          </Gutter>
        ) : null}

        {/* The heading is what clears the greeting panel, so without it the
            body needs its own top padding — otherwise the error card and the
            skeleton sit flush against the panel's rounded edge. */}
        <Gutter className={!isDesktop && !showHeading ? "pt-6" : undefined}>
          {/* Offline outranks every other state, error included. It has to be
              checked here rather than left to `orders` being absent, because
              the cached rows survive the switch — react-query keeps the data of
              a query it has stopped running — and a failure from before going
              offline would otherwise leave a retry button on a feed the rider
              has deliberately closed. */}
          {!online ? (
            <Empty
              title="You're offline"
              body="Turn on availability to see and claim orders for this Wave."
            />
          ) : isLoading ? (
            <ListSkeleton rows={3} />
          ) : isError ? (
            <ListError onRetry={() => void refetch()} />
          ) : !orders || orders.length === 0 ? (
            <Empty
              title="Nothing waiting"
              body="New orders land here as students place them for this Wave."
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
      accessible
      accessibilityLabel={[
        order.shop?.name ?? "Shop",
        `to ${order.checkpoint?.name ?? "checkpoint"}`,
        order.estimatedEarning
          ? `you earn ${formatGhs(Number(order.estimatedEarning))}`
          : `${formatGhs(Number(order.deliveryFee))} delivery fee`,
      ].join(", ")}
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
      <View className="w-28">
        {/* The fee is what the student pays; the earning is what the rider
            takes. Showing only the first has meant riders judging a job by a
            number that is not theirs. Server-computed with the same rate that
            writes the earning on delivery, so it cannot quote a share the
            payment then contradicts. */}
        <Text className="font-sans-semibold text-body text-ink">
          {order.estimatedEarning
            ? formatGhs(Number(order.estimatedEarning))
            : formatGhs(Number(order.deliveryFee))}
        </Text>
        {order.estimatedEarning ? (
          <Text className="font-sans text-meta text-muted">you earn</Text>
        ) : null}
      </View>
      <ChevronRightIcon size={18} color={colors.icon} strokeWidth={2} />
    </Pressable>
  );
}
