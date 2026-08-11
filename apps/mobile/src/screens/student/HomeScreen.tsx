import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  BrandBar,
  CardGrid,
  CardRail,
  Chip,
  PhotoCard,
  ProgressRail,
  Screen,
  ScreenBody,
  Gutter,
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
  const { gutter } = useLayout();
  const { data: shops, isLoading: shopsLoading } = useShops();
  const { data: orders } = useMyOrders();
  const wave = useWave();
  const [category, setCategory] = useState<string | null>(null);

  // The filter rail is derived from the data, not an enum — `shop.category` is
  // free text and the seed's distinct values *are* the rail. See PLAN.md.
  const categories = useMemo(
    () => Array.from(new Set((shops ?? []).map((s) => s.category).filter(Boolean))).sort(),
    [shops],
  );

  const visible = useMemo(
    () => (category ? (shops ?? []).filter((s) => s.category === category) : (shops ?? [])),
    [shops, category],
  );

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

      <ScreenBody bottomInset={32}>
        <Gutter className="pb-4 pt-1">
          {wave && !wave.closed ? (
            <WaveBanner wave={wave} onPress={() => navigation.navigate("WaveCalendar")} />
          ) : (
            <WaveClosedBanner onPress={() => navigation.navigate("WaveCalendar")} />
          )}
        </Gutter>

        <Gutter className="pb-4">
          <SearchCapsule
            waveLabel={wave?.dateLabel ?? "Next Wave"}
            onPressQuery={() => navigation.navigate("ShopSelection", waveDate)}
            onPressWave={() => navigation.navigate("WaveCalendar")}
            onSubmit={() => navigation.navigate("ShopSelection", waveDate)}
          />
          <Pressable
            onPress={() => navigation.navigate("PickupRequest", waveDate)}
            accessibilityRole="button"
            className="mt-3 self-start"
          >
            <Text className="font-sans-medium text-body text-ink">Need a package pickup instead?</Text>
          </Pressable>
        </Gutter>

        {categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}
            className="mb-6 grow-0"
          >
            <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
            {categories.map((c) => (
              <Chip
                key={c}
                label={titleCase(c)}
                selected={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </ScrollView>
        ) : null}

        {live ? (
          <LiveOrderCard
            order={live}
            onPress={() => openOrderTracking(navigation, live.id)}
          />
        ) : null}

        <Section
          title={wave ? `On ${wave.name}` : "Open now"}
          loading={shopsLoading}
          shops={visible}
          navigation={navigation}
          waveDate={waveDate}
          emptyNote={category ? `No ${titleCase(category)} shops on this Wave.` : undefined}
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
