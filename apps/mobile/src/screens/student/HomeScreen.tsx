import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  BrandBar,
  Button,
  CardGrid,
  CardRail,
  Gutter,
  ModeTabs,
  PhotoCard,
  ProgressRail,
  ResumeOrderCard,
  Screen,
  ScreenBody,
  SearchCapsule,
  SectionTitle,
  HowPickupWorks,
  MoveItAgain,
  ServicePausedNotice,
  ShopsComingCard,
  SuggestShopCard,
  SkeletonCard,
  StatusPill,
  Thumb,
  WaveBanner,
  WaveClosedBanner,
} from "../../components/v6";
import { useLayout } from "../../hooks/useLayout";
import { openOrderTracking } from "../../lib/desktopNavigate";
import { useShops } from "../../lib/shops";
import { useMyOrders, useRecentPickupRoutes } from "../../lib/orders";
import { useWave } from "../../lib/wave";
import { useBuyForMeStatus, useServiceStatus } from "../../lib/serviceStatus";
import { formatGhsCompact, isStandardRunDay } from "../../lib/pricing";
import { useCheckpoints } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { DEFAULT_DELIVERY_FEE_GHS } from "@wave/shared";
import { orderProgress, statusPill } from "./orderPresenters";
import { StudentHomeWeb } from "./web/StudentHomeWeb";
import type { ServiceMode } from "../../components/v6";
import type { Order, Shop } from "../../types";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

const RAIL_CARD_W = 168;

/**
 * Student home. Web uses a dedicated browse layout; native keeps the phone UI.
 */
export function HomeScreen() {
  const { isDesktop } = useLayout();
  if (isDesktop) return <StudentHomeWeb />;
  return <HomeScreenMobile />;
}

function HomeScreenMobile() {
  const navigation = useNavigation<Nav>();
  const { launched: buyForMeLaunched, settled: serviceSettled } = useBuyForMeStatus();
  const pickupRoutes = useRecentPickupRoutes();
  const { data: shops, isLoading: shopsLoading } = useShops({
    enabled: serviceSettled && buyForMeLaunched,
  });
  const { data: orders } = useMyOrders();
  const ordersLoaded = orders !== undefined;
  const wave = useWave();
  const [mode, setMode] = useState<ServiceMode>("buy");
  const { data: service } = useServiceStatus();
  const universityId = useAuthStore((state) => state.profile?.universityId ?? undefined);
  const { data: checkpoints } = useCheckpoints(universityId);
  const checkpointCount = checkpoints?.length ?? 0;
  // Before Buy for me launches there is only one service, so there is nothing
  // to switch between and no shops to show.
  const effectiveMode: ServiceMode = buyForMeLaunched ? mode : "pickup";
  const paused = effectiveMode === "pickup" ? service?.pickup : service?.buy_for_me;

  /**
   * The Wave a Home tap books onto: the next open one. Tapping a shop from Home
   * is the shortcut past the calendar, so it needs a date to carry forward —
   * the calendar remains the way to pick a different one.
   */
  const waveDate = useMemo(
    () => ({
      scheduledDate: (wave?.date ?? new Date()).toISOString(),
      isSpecialOrder: wave ? !isStandardRunDay(wave.date) : false,
    }),
    [wave],
  );

  const live = (orders ?? []).find((o) =>
    ["confirmed", "rider_assigned", "en_route", "at_checkpoint"].includes(o.status),
  );

  /**
   * An order built and then abandoned at Paystack. `live` starts at `confirmed`,
   * so until this card existed a `payment_pending` order showed up nowhere on
   * Home and the only way back was to rebuild the basket from scratch.
   */
  const unpaid = (orders ?? []).find((o) => o.status === "payment_pending");

  const orderedBefore = useMemo(() => {
    const ids = new Set(
      (orders ?? [])
        .filter((o) => o.status === "delivered")
        .map((o) => o.shopId)
        // Pickups have no shop, and a null in this set would match nothing
        // anyway — filtered for clarity rather than correctness.
        .filter((id): id is string => !!id),
    );
    return (shops ?? []).filter((s) => ids.has(s.id));
  }, [orders, shops]);

  return (
    <Screen>
      <BrandBar />

      {/* Both services, always visible. Tabs rather than a filled control:
          Home already carries a shadowed capsule and the Wave card, and a third
          container was what made the screen feel crowded. */}
      {buyForMeLaunched ? (
        <Gutter>
          <ModeTabs mode={mode} onChange={setMode} />
        </Gutter>
      ) : null}

      <ScreenBody bottomInset={32}>
        {/* A pause outranks everything, search included: it is the one thing
            on this screen that changes whether any of the rest will work. */}
        {paused?.paused ? (
          <Gutter className="pt-5">
            <ServicePausedNotice
              service={effectiveMode === "pickup" ? "Pickup" : "Buy for me"}
              message={paused.message ?? ""}
              resumeAt={paused.resumeAt}
            />
          </Gutter>
        ) : null}

        {/* Search leads — once there is something to search. Before Buy for me
            launches the only journey is a pickup, and the capsule was a second
            door to the screen the button already opens. */}
        {buyForMeLaunched ? (
          <Gutter className="pb-4 pt-5">
            <SearchCapsule
              mode={effectiveMode}
              onPressQuery={() =>
                effectiveMode === "pickup"
                  ? navigation.navigate("PickupRequest", waveDate)
                  : navigation.navigate("ShopSelection", { ...waveDate, focusSearch: true })
              }
              onSubmit={() =>
                effectiveMode === "pickup"
                  ? navigation.navigate("PickupRequest", waveDate)
                  : navigation.navigate("ShopSelection", { ...waveDate, focusSearch: true })
              }
            />
          </Gutter>
        ) : null}

        <Gutter className={buyForMeLaunched ? "pb-4" : "pb-4 pt-5"}>
          {wave && !wave.closed ? (
            <WaveBanner wave={wave} onPress={() => navigation.navigate("WaveCalendar")} />
          ) : (
            <WaveClosedBanner onPress={() => navigation.navigate("WaveCalendar")} />
          )}
        </Gutter>

        {unpaid ? (
          <Gutter>
            <ResumeOrderCard
              order={unpaid}
              onPress={() =>
                navigation.navigate("Payment", {
                  orderId: unpaid.id,
                  totalAmount: Number(unpaid.totalAmount),
                })
              }
            />
          </Gutter>
        ) : null}

        {live ? (
          <LiveOrderCard
            order={live}
            onPress={() => openOrderTracking(navigation, live.id)}
          />
        ) : null}

        {/* A shop rail is meaningless when nothing is being bought, so Pickup
            gets the thing it actually needs: the route, again. */}
        {effectiveMode === "pickup" ? (
          <>
            <Gutter>
              <Text className="mb-1 font-sans-medium text-heading-sm text-ink">Move a package</Text>
              {/* Two facts rather than a paragraph: what it costs and how many
                  places it can be handed over. Both read from live data. */}
              <Text className="mb-4 font-sans text-body text-muted">
                Flat {formatGhsCompact(DEFAULT_DELIVERY_FEE_GHS)} between campus checkpoints
                {checkpointCount ? ` · ${checkpointCount} pickup points on campus` : ""}.
              </Text>
              <Button
                label="Start a pickup"
                full={false}
                disabled={!!paused?.paused}
                onPress={() => navigation.navigate("PickupRequest", waveDate)}
              />
            </Gutter>

            {/* A route this student has sent before is one tap. Absent for
                anyone who has not sent a package yet. */}
            <Gutter className="pt-6">
              <MoveItAgain
                onPick={(route) =>
                  navigation.navigate("PickupRequest", {
                    ...waveDate,
                    fromId: route.originId,
                    toId: route.destinationId,
                  })
                }
              />
            </Gutter>

            {/* Before Buy for me launches, Pickup is the whole product and the
                screen is otherwise empty: explain it, and give students the one
                lever that fills the catalogue. */}
            {!buyForMeLaunched ? (
              <>
                {/* Only for someone who has not sent a package: the routes
                    above say more to anyone who has. Waits for the orders to
                    load, or the card appears for a second and then vanishes
                    under someone who has sent plenty. */}
                {ordersLoaded && pickupRoutes.length === 0 ? (
                  <Gutter className="pt-6">
                    <HowPickupWorks />
                  </Gutter>
                ) : null}
                <Gutter className="pt-3">
                  <ShopsComingCard
                    onSuggest={() => navigation.navigate("SuggestShop", waveDate)}
                  />
                </Gutter>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Section
              title={wave ? `On ${wave.name}` : "Open now"}
              loading={shopsLoading}
              shops={shops ?? []}
              navigation={navigation}
              waveDate={waveDate}
            />

            {orderedBefore.length > 0 ? (
              <Section
                title="You ordered before"
                loading={false}
                shops={orderedBefore}
                navigation={navigation}
                waveDate={waveDate}
              />
            ) : null}

            {/* The shop a student wanted and did not find is only recorded if
                asking is reachable from here — searching and settling never
                reaches the shop list's empty state. */}
            <Gutter className="pt-4">
              <SuggestShopCard
                onSuggest={() => navigation.navigate("SuggestShop", waveDate)}
              />
            </Gutter>
          </>
        )}
      </ScreenBody>
    </Screen>
  );
}

function Section({
  title,
  shops,
  loading,
  navigation,
  waveDate,
  emptyNote,
}: {
  title: string;
  shops: Shop[];
  loading: boolean;
  navigation: Nav;
  waveDate: { scheduledDate: string; isSpecialOrder: boolean };
  emptyNote?: string;
}) {
  const { useShopGrid, cardWidth, shopColumns } = useLayout();
  const width = useShopGrid ? cardWidth : RAIL_CARD_W;

  const cards = (list: Shop[]) =>
    list.map((shop) => (
      <PhotoCard
        key={shop.id}
        width={width}
        imageUrl={shop.logoUrl}
        title={shop.name}
        meta={shop.locationText ?? titleCase(shop.category)}
        priceLabel="from"
        priceValue={`${formatGhsCompact(DEFAULT_DELIVERY_FEE_GHS)} delivery`}
        badge={shop.isActive ? undefined : "Paused"}
        onPress={() =>
          navigation.navigate("ShopMenu", {
            shopId: shop.id,
            shopName: shop.name,
            scheduledDate: waveDate.scheduledDate,
            isSpecialOrder: waveDate.isSpecialOrder,
          })
        }
      />
    ));

  return (
    <View className="mb-section">
      <Gutter className="mb-3">
        <SectionTitle title={title} onPress={() => navigation.navigate("ShopSelection")} />
      </Gutter>

      {loading ? (
        useShopGrid ? (
          <CardGrid>
            {Array.from({ length: shopColumns }, (_, i) => (
              <SkeletonCard key={i} width={cardWidth} />
            ))}
          </CardGrid>
        ) : (
          <CardRail>
            <SkeletonCard width={RAIL_CARD_W} />
            <SkeletonCard width={RAIL_CARD_W} />
          </CardRail>
        )
      ) : shops.length === 0 ? (
        <Gutter>
          <Text className="font-sans text-body text-muted">
            {emptyNote ?? "Nothing here yet."}
          </Text>
        </Gutter>
      ) : useShopGrid ? (
        <CardGrid>{cards(shops)}</CardGrid>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <CardRail>{cards(shops)}</CardRail>
        </ScrollView>
      )}
    </View>
  );
}

/**
 * The live order strip. Replaces v5's "Active orders" list — a student has at
 * most one order in flight in practice, and a one-item list is a card wearing a
 * heading.
 */
function LiveOrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const pill = statusPill(order.status);
  return (
    <Gutter className="mb-section">
      <View className="rounded-card bg-surface p-4">
        <View className="mb-3 flex-row items-center gap-3">
          <Thumb uri={order.shop?.logoUrl} size={48} />
          <View className="flex-1">
            <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
              {order.shop?.name ?? "Your order"}
            </Text>
            <Text className="font-sans text-body text-muted" numberOfLines={1}>
              To {order.checkpoint?.name ?? "your checkpoint"}
            </Text>
          </View>
          <StatusPill label={pill.label} tone={pill.tone} />
        </View>
        <ProgressRail ratio={orderProgress(order.status)} />
        <Text
          className="pt-3 font-sans-medium text-body text-ink"
          onPress={onPress}
          accessibilityRole="button"
        >
          Track this order
        </Text>
      </View>
    </Gutter>
  );
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
