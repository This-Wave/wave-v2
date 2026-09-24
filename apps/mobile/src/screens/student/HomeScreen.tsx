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
  SkeletonCard,
  StatusPill,
  Thumb,
  WaveBanner,
  WaveClosedBanner,
} from "../../components/v6";
import { useLayout } from "../../hooks/useLayout";
import { openOrderTracking } from "../../lib/desktopNavigate";
import { useShops } from "../../lib/shops";
import { useMyOrders } from "../../lib/orders";
import { useWave } from "../../lib/wave";
import { formatGhsCompact, isStandardRunDay } from "../../lib/pricing";
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
  const { data: shops, isLoading: shopsLoading } = useShops();
  const { data: orders } = useMyOrders();
  const wave = useWave();
  const [mode, setMode] = useState<ServiceMode>("buy");

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
      <Gutter>
        <ModeTabs mode={mode} onChange={setMode} />
      </Gutter>

      <ScreenBody bottomInset={32}>
        {/* Search leads. The Wave reads as context beneath it rather than
            competing with it for the top of the screen. */}
        <Gutter className="pb-4 pt-5">
          <SearchCapsule
            mode={mode}
            onPressQuery={() =>
              mode === "pickup"
                ? navigation.navigate("PickupRequest", waveDate)
                : navigation.navigate("ShopSelection", { ...waveDate, focusSearch: true })
            }
            onSubmit={() =>
              mode === "pickup"
                ? navigation.navigate("PickupRequest", waveDate)
                : navigation.navigate("ShopSelection", { ...waveDate, focusSearch: true })
            }
          />
        </Gutter>

        <Gutter className="pb-4">
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
        {mode === "pickup" ? (
          <Gutter>
            <Text className="mb-3 font-sans-medium text-heading-sm text-ink">Move a package</Text>
            <Text className="mb-4 font-sans text-body text-muted">
              We&apos;ll collect it from one campus checkpoint and drop it at another. You pay the
              delivery fee only — there is nothing for us to buy.
            </Text>
            <Button
              label="Start a pickup"
              full={false}
              onPress={() => navigation.navigate("PickupRequest", waveDate)}
            />
          </Gutter>
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
