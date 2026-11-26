import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActiveDeliveryCard,
  Button,
  CardGrid,
  CardRail,
  Gutter,
  ModeTabs,
  PhotoCard,
  ResumeOrderCard,
  Screen,
  ScreenBody,
  SearchCapsule,
  SectionTitle,
  GreetingHeader,
  ServicePausedNotice,
  SuggestShopCard,
  SkeletonCard,
  WaveStrip,
  QuickTiles,
} from "../../components/v6";
import { useLayout } from "../../hooks/useLayout";
import { openOrderTracking } from "../../lib/desktopNavigate";
import { useShops } from "../../lib/shops";
import { LIVE_ORDER_STATUSES, useMyOrders } from "../../lib/orders";
import { useWave } from "../../lib/wave";
import { useBuyForMeStatus, useServiceStatus } from "../../lib/serviceStatus";
import { formatGhsCompact, isStandardRunDay } from "../../lib/pricing";
import { useAuthStore, useIsGuest } from "../../store/authStore";
import { DEFAULT_DELIVERY_FEE_GHS } from "@wave/shared";
import { HomeSkeleton } from "./HomeSkeleton";
import { StudentHomeWeb } from "./web/StudentHomeWeb";
import type { ServiceMode } from "../../components/v6";
import type { Shop } from "../../types";
import { GiftIcon, PlusIcon, StoreIcon } from "../../components/icons";
import { Illustration } from "../../components/v7/Illustration";
import { OrderCardRow, ParcelHero } from "../../components/v7/OrderCards";
import { colors } from "../../theme/tokens";

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
  const { data: shops, isLoading: shopsLoading } = useShops({
    enabled: serviceSettled && buyForMeLaunched,
  });
  const { data: orders } = useMyOrders();
  // A guest has no orders to fetch (the query never runs), so for them the
  // list is simply empty rather than forever loading.
  const isGuest = useIsGuest();
  const ordersLoaded = isGuest || orders !== undefined;
  const wave = useWave();
  const [mode, setMode] = useState<ServiceMode>("buy");
  const { data: service } = useServiceStatus();
  const profileName = useAuthStore((state) => state.profile?.fullName ?? state.guestFirstName ?? "there");
  const avatarUrl = useAuthStore((state) => state.profile?.avatarUrl ?? null);
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

  const active = (orders ?? []).filter((o) => LIVE_ORDER_STATUSES.includes(o.status));
  const recent = (orders ?? []).filter((o) => o.status === "delivered").slice(0, 3);

  return (
    <Screen>
      <ScreenBody bottomInset={32}>
        {/* One ink panel: who you are, what you can do, and — once there are
            shops — the search. Everything below it is white on canvas bar the
            Wave strip, so the screen has a single anchor rather than five
            blocks of equal weight. */}
        <GreetingHeader
          name={profileName}
          avatarUrl={avatarUrl}
          alert={active.length > 0 || !!unpaid}
          onPressAvatar={() => navigation.navigate("Tabs", { screen: "Profile" })}
          onPressBell={() => navigation.navigate("Tabs", { screen: "Orders" })}
          note={
            effectiveMode === "pickup" && active[0] ? (
              <ParcelHero order={active[0]} onTrack={() => openOrderTracking(navigation, active[0]!.id)} />
            ) : undefined
          }
          title={
            !ordersLoaded
              ? undefined
              : active.length > 0
                ? `${active.length} parcel${active.length === 1 ? "" : "s"} on the way`
                : undefined
          }
        >
          {buyForMeLaunched ? (
            <View className="mb-3">
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
            </View>
          ) : null}

          {/* Both tiles stay in the panel, which is where every role's primary
              action already lives. The reference puts them on the page below
              its header, but Wave's panel *is* the action zone — moving them
              out would make three distinct blocks to cross before the content. */}
          {/* v7 canvas: three round keys. Hidden on the empty Home, where the
              one big Send button below does this job. */}
          {!ordersLoaded || active.length > 0 || !!unpaid || buyForMeLaunched ? (
            <QuickTiles
              actions={[
                {
                  label: "Send",
                  icon: <PlusIcon size={22} color={colors.onLime} strokeWidth={2.2} />,
                  disabled: !!paused?.paused,
                  onPress: () => navigation.navigate("PickupRequest", waveDate),
                },
                {
                  label: "Suggest a shop",
                  icon: <StoreIcon size={21} color={colors.ink} strokeWidth={1.9} />,
                  onPress: () => navigation.navigate("SuggestShop", waveDate),
                },
                {
                  label: "Your code",
                  icon: <GiftIcon size={21} color={colors.ink} strokeWidth={1.9} />,
                  onPress: () =>
                    active[0]
                      ? navigation.navigate("PickupPin", { orderId: active[0].id })
                      : navigation.navigate("Tabs", { screen: "Orders" }),
                },
              ]}
            />
          ) : null}
        </GreetingHeader>

        {/* The Wave's deadline, on the one tinted ground on the screen. Below
            the panel rather than inside it: in the panel it stopped reading as
            something you could press, and the panel was carrying three
            unrelated jobs. */}
        {effectiveMode !== "pickup" ? (
          <Gutter className="pt-5">
            <WaveStrip wave={wave} onPress={() => navigation.navigate("WaveCalendar")} />
          </Gutter>
        ) : null}

        {/* Both services, once there are two. */}
        {buyForMeLaunched ? (
          <Gutter className="pt-5">
            <ModeTabs mode={mode} onChange={setMode} />
          </Gutter>
        ) : null}
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

        {/* The Wave had a card of its own here once. It is the strip under the
            panel now, so the first thing in this position is whatever the
            student actually has to act on. */}

        {/* Every section below is derived from `/orders/my`, and the newcomer
            explainer is deliberately held back until it resolves, so without
            this Home waits with an empty screen rather than a loading one. */}
        {!ordersLoaded ? (
          <Gutter className="pt-5">
            <HomeSkeleton />
          </Gutter>
        ) : null}

        {unpaid ? (
          <Gutter className="pt-5">
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

        {/* More than one parcel: the first is the card above, the rest are
            rows here. Buy for me keeps the old cards. */}
        {active.length > (effectiveMode === "pickup" ? 1 : 0) ? (
          <Gutter className="pt-5">
            <Text className="mb-3 font-sans-bold text-ui text-ink">
              {effectiveMode === "pickup" ? "Also on the way" : "Active deliveries"}
            </Text>
            <View style={{ gap: 8 }}>
              {active.slice(effectiveMode === "pickup" ? 1 : 0).map((order) => (
                <ActiveDeliveryCard
                  key={order.id}
                  order={order}
                  onPress={() => openOrderTracking(navigation, order.id)}
                />
              ))}
            </View>
          </Gutter>
        ) : null}

        {/* A shop rail is meaningless when nothing is being bought, so Pickup
            gets the thing it actually needs: the route, again. */}
        {effectiveMode === "pickup" ? (
          <>
            {ordersLoaded && active.length === 0 && !unpaid ? (
              <Gutter className="items-center pt-2">
                <Illustration name="pillow" width={220} height={150} />
                <Text accessibilityRole="header" className="mt-4 text-center font-display text-heading text-ink">
                  Nothing on the way yet
                </Text>
                <Text className="mb-5 mt-2 text-center font-sans text-body text-muted">
                  Someone in Accra can hand it over today.
                </Text>
                <View className="self-stretch">
                  <Button
                    label="Send a package"
                    icon={<PlusIcon size={18} color={colors.onLime} strokeWidth={2.2} />}
                    disabled={!!paused?.paused}
                    onPress={() => navigation.navigate("PickupRequest", waveDate)}
                  />
                </View>
              </Gutter>
            ) : null}
            <Gutter className="pt-5">
              <WaveStrip wave={wave} onPress={() => navigation.navigate("WaveCalendar")} />
            </Gutter>
            {recent.length > 0 ? (
              <Gutter className="pt-6">
                <Text className="mb-3 font-sans-bold text-ui text-ink">Recent</Text>
                <View style={{ gap: 8 }}>
                  {recent.map((o) => (
                    <OrderCardRow
                      key={o.id}
                      order={o}
                      onPress={() => navigation.navigate("OrderDetail", { orderId: o.id })}
                    />
                  ))}
                </View>
              </Gutter>
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


function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
