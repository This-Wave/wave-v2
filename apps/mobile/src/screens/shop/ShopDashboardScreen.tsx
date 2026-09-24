import { useMemo } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ShopStackParamList } from "../../navigation/ShopNavigator";
import {
  GreetingHeader,
  Switch,
  Empty,
  Gutter,
  ListError,
  ListSkeleton,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  StatusPill,
} from "../../components/v6";
import { ShopSwitcher } from "../../components/shop/ShopSwitcher";
import { useAuthStore } from "../../store/authStore";
import { useSelectedShop, useSetShopServing, useShopOrders } from "../../lib/shopOwner";
import { useWave } from "../../lib/wave";
import { useLayout } from "../../hooks/useLayout";
import { openShopIncoming } from "../../lib/desktopNavigate";
import { formatGhs } from "../../lib/pricing";

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

/**
 * The shop owner's morning screen: how today is going, and what needs a
 * decision right now.
 */
export function ShopDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { shop, shops, selectShop, isLoading: shopLoading } = useSelectedShop();
  const { data: allOrders, isLoading: ordersLoading, isError, refetch, isRefetching } = useShopOrders();
  const wave = useWave();
  const { isDesktop } = useLayout();

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
  const profile = useAuthStore((state) => state.profile);
  const setServing = useSetShopServing(shop?.id);

  return (
    <Screen>
      <ScreenBody
        bottomInset={24}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      >
        {isDesktop ? (
          <Gutter className="pb-8 pt-8">
            <View className="mb-2 flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="font-sans-bold text-heading text-ink">
                  {shop?.name ?? "Your shop"}
                </Text>
                <Text className="mt-1 font-sans text-ui text-muted">
                  {wave
                    ? `${wave.name} · closes in ${wave.countdown}. Flag anything you can’t fulfil.`
                    : "Today’s Wave and what needs a decision."}
                </Text>
              </View>
              {/* An unverified shop is invisible to students regardless of
                  `isActive`, so showing "Serving" here would be a lie the owner
                  acts on — they would sit waiting for orders that cannot arrive. */}
              <StatusPill
                label={
                  shop && !shop.isVerified ? "Awaiting approval" : shop?.isActive ? "Serving" : "Closed"
                }
                tone={shop && !shop.isVerified ? "neutral" : shop?.isActive ? "done" : "neutral"}
              />
            </View>
          </Gutter>
        ) : (
          /* Open or closed is the shop's equivalent of a rider going online,
             so it sits in the panel. An unverified shop gets the truth instead
             of a switch it cannot act on. */
          <GreetingHeader
            name={shop?.name ?? profile?.fullName ?? "there"}
            wholeName={!!shop?.name}
            avatarUrl={profile?.avatarUrl}
            alert={incoming.length > 0}
            onPressAvatar={() => navigation.navigate("Tabs", { screen: "Settings" })}
            onPressBell={() => navigation.navigate("Tabs", { screen: "ShopOrders" })}
          >
            <View className="flex-row items-center gap-3 rounded-card bg-surface px-4 py-3.5">
              <View className="min-w-0 flex-1">
                <Text className="font-sans-medium text-ui text-ink">
                  {shop && !shop.isVerified
                    ? "Awaiting approval"
                    : shop?.isActive
                      ? "Open for orders"
                      : "Closed"}
                </Text>
                <Text className="font-sans text-body text-muted" numberOfLines={1}>
                  {shop && !shop.isVerified
                    ? "Students can't see you yet"
                    : wave
                      ? `${wave.name} · closes in ${wave.countdown}`
                      : "Next Wave"}
                </Text>
              </View>
              {shop?.isVerified ? (
                <Switch
                  value={shop?.isActive ?? false}
                  onValueChange={(next) => setServing.mutate(next)}
                  accessibilityLabel="Open for orders"
                  accessibilityHint="Turn off to stop new orders arriving"
                />
              ) : null}
            </View>
          </GreetingHeader>
        )}

        {shop && !shop.isVerified ? (
          <Gutter className="pb-4">
            <View className="rounded-card bg-surface px-4 py-3.5">
              <Text className="mb-1 font-sans-medium text-body text-ink">
                Waiting for approval
              </Text>
              <Text className="font-sans text-body text-muted">
                Students can&apos;t see your shop yet. An admin is checking it — usually within a
                day. Add your menu now and it will be ready the moment you&apos;re approved.
              </Text>
            </View>
          </Gutter>
        ) : null}

        {shops && shops.length > 1 ? (
          <Gutter className="mb-6 pt-5">
            <ShopSwitcher shops={shops} selectedId={shop?.id} onSelect={selectShop} />
          </Gutter>
        ) : null}

        <Gutter className={`mb-section flex-row ${isDesktop ? "gap-16" : "gap-8"}`}>
          {isLoading ? (
            <ListSkeleton rows={1} />
          ) : (
            <>
              <View>
                <Text className="font-sans text-body text-muted">Orders today</Text>
                <Text
                  className="mt-1 font-sans-bold text-ink"
                  style={{ fontSize: isDesktop ? 48 : 40, lineHeight: isDesktop ? 52 : 44 }}
                >
                  {todaysOrders.length}
                </Text>
              </View>
              <View>
                <Text className="font-sans text-body text-muted">Order value today</Text>
                <Text
                  className="mt-1 font-sans-bold text-ink"
                  style={{ fontSize: isDesktop ? 48 : 40, lineHeight: isDesktop ? 52 : 44 }}
                >
                  {formatGhs(revenueToday)}
                </Text>
              </View>
            </>
          )}
        </Gutter>

        <Gutter className="mb-3 flex-row items-center gap-2">
          <Text className="font-sans-medium text-heading-sm text-ink">Needs you</Text>
          {incoming.length > 0 ? (
            <StatusPill label={`${incoming.length}`} tone="active" />
          ) : null}
        </Gutter>

        <Gutter>
          {isLoading ? (
            <ListSkeleton rows={2} />
          ) : isError ? (
            <ListError onRetry={() => void refetch()} />
          ) : incoming.length === 0 ? (
            <Empty title="All clear" body="Paid orders waiting on you will appear here." />
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
                  onPress={() => openShopIncoming(navigation, order.id)}
                />
              ))}
            </RowGroup>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
