import { useMemo } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ShopStackParamList } from "../../navigation/ShopNavigator";
import {
  Empty,
  Gutter,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Skeleton,
  StatusPill,
} from "../../components/v6";
import { ShopSwitcher } from "../../components/shop/ShopSwitcher";
import { useSelectedShop, useShopOrders } from "../../lib/shopOwner";
import { useWave } from "../../lib/wave";
import { formatGhs } from "../../lib/pricing";

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

/**
 * The shop owner's morning screen: how today is going, and what needs a
 * decision right now.
 *
 * v5 put two stat cards side by side in boxes. The numbers now sit directly on
 * the canvas at display size — a stat in a bordered box reads as a widget, and
 * these two are the point of the screen.
 */
export function ShopDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { shop, shops, selectShop, isLoading: shopLoading } = useSelectedShop();
  const { data: allOrders, isLoading: ordersLoading } = useShopOrders();
  const wave = useWave();

  // /orders/shop returns every order across every shop this owner holds, so the
  // dashboard narrows to the one being viewed.
  const orders = useMemo(
    () => (shop ? allOrders?.filter((o) => o.shopId === shop.id) : allOrders),
    [allOrders, shop],
  );

  const incoming = orders?.filter((o) => o.status === "confirmed" && !o.riderId) ?? [];
  const todaysOrders = useMemo(() => orders?.filter((o) => isToday(o.createdAt)) ?? [], [orders]);
  const revenueToday = todaysOrders
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const isLoading = shopLoading || ordersLoading;

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-6 pt-4">
          <View className="mb-2 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <PageTitle>{shop?.name ?? "Your shop"}</PageTitle>
            </View>
            <StatusPill
              label={shop?.isActive ? "Serving" : "Closed"}
              tone={shop?.isActive ? "done" : "neutral"}
            />
          </View>
          <Text className="font-sans text-body text-muted">
            {wave ? `${wave.name} · closes in ${wave.countdown}` : "Next Wave"}
          </Text>
        </Gutter>

        {shops && shops.length > 1 ? (
          <Gutter className="mb-6">
            <ShopSwitcher shops={shops} selectedId={shop?.id} onSelect={selectShop} />
          </Gutter>
        ) : null}

        <Gutter className="mb-section flex-row gap-8">
          {isLoading ? (
            <Skeleton height={64} radius={12} />
          ) : (
            <>
              <View>
                <Text className="font-sans text-body text-muted">Orders today</Text>
                <Text
                  className="mt-1 font-sans-bold text-ink"
                  style={{ fontSize: 40, lineHeight: 44 }}
                >
                  {todaysOrders.length}
                </Text>
              </View>
              <View>
                <Text className="font-sans text-body text-muted">Taken</Text>
                <Text
                  className="mt-1 font-sans-bold text-ink"
                  style={{ fontSize: 40, lineHeight: 44 }}
                >
                  {formatGhs(revenueToday)}
                </Text>
              </View>
            </>
          )}
        </Gutter>

        <Gutter className="mb-3 flex-row items-center gap-2">
          <Text className="font-sans-medium text-subheading text-ink">Needs you</Text>
          {incoming.length > 0 ? (
            <StatusPill label={`${incoming.length}`} tone="active" />
          ) : null}
        </Gutter>

        <Gutter>
          {isLoading ? (
            <View className="gap-2">
              <Skeleton height={64} radius={12} />
              <Skeleton height={64} radius={12} />
            </View>
          ) : incoming.length === 0 ? (
            <Empty
              title="All clear"
              body="Paid orders waiting on you will appear here."
            />
          ) : (
            <RowGroup>
              {incoming.map((order) => (
                <Row
                  key={order.id}
                  title={order.student?.fullName ?? "Student"}
                  meta={order.itemDescription}
                  trailing={
                    <Text className="font-sans-semibold text-body text-ink">
                      {formatGhs(Number(order.totalAmount))}
                    </Text>
                  }
                  onPress={() =>
                    navigation.navigate("IncomingOrderDetail", { orderId: order.id })
                  }
                />
              ))}
            </RowGroup>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
