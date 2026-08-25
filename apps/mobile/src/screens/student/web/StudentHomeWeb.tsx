import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../../navigation/StudentNavigator";
import {
  Button,
  CardGrid,
  Chip,
  PhotoCard,
  ProgressRail,
  Screen,
  ScreenBody,
  Gutter,
  SearchCapsule,
  SkeletonCard,
  StatusPill,
  Thumb,
} from "../../../components/v6";
import { ChevronRightIcon } from "../../../components/icons";
import { colors } from "../../../theme/tokens";
import { useLayout } from "../../../hooks/useLayout";
import { useShops } from "../../../lib/shops";
import { useMyOrders } from "../../../lib/orders";
import { useWave } from "../../../lib/wave";
import { formatGhsCompact, isStandardRunDay } from "../../../lib/pricing";
import {
  openOrderTracking,
  openShopMenu,
  openWaveCalendar,
} from "../../../lib/desktopNavigate";
import { DEFAULT_DELIVERY_FEE_GHS } from "@wave/shared";
import { orderProgress, statusPill } from "../orderPresenters";
import type { Order, Shop } from "../../../types";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

/**
 * Desktop home — structured like a browse site, not a blown-up phone screen.
 * Mobile keeps `HomeScreen`'s original layout.
 */
export function StudentHomeWeb() {
  const navigation = useNavigation<Nav>();
  const { cardWidth, shopColumns } = useLayout();
  const { data: shops, isLoading } = useShops();
  const { data: orders } = useMyOrders();
  const wave = useWave();
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set((shops ?? []).map((s) => s.category).filter(Boolean))).sort(),
    [shops],
  );

  const visible = useMemo(
    () => (category ? (shops ?? []).filter((s) => s.category === category) : (shops ?? [])),
    [shops, category],
  );

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

  return (
    <Screen>
      <ScreenBody bottomInset={48}>
        <Gutter className="flex-row items-end justify-between pb-8 pt-8">
          <View className="flex-1 pr-6">
            <Text className="font-sans-bold text-heading text-ink">Browse shops</Text>
            <Text className="mt-1 font-sans text-ui text-muted">
              Order from campus partners. We buy and bring it to your checkpoint.
            </Text>
          </View>
          <Pressable
            onPress={() => openWaveCalendar(navigation)}
            accessibilityRole="button"
            className="rounded-pill bg-surface px-4 py-2.5 active:bg-hairline"
          >
            <Text className="font-sans-medium text-body text-ink">
              {wave && !wave.closed
                ? `${wave.name} · ${wave.countdown} left`
                : "Pick a Wave day"}
            </Text>
          </Pressable>
        </Gutter>

        <Gutter className="mb-8">
          <SearchCapsule
            waveLabel={wave?.dateLabel ?? "Next Wave"}
            onPressQuery={() => navigation.navigate("ShopSelection", { ...waveDate, focusSearch: true })}
            onPressWave={() => openWaveCalendar(navigation)}
            onSubmit={() => navigation.navigate("ShopSelection", { ...waveDate, focusSearch: true })}
          />
          <Pressable
            onPress={() => navigation.navigate("PickupRequest", waveDate)}
            accessibilityRole="button"
            className="mt-3 self-start"
          >
            <Text className="font-sans-medium text-body text-ink">
              Need a package pickup instead?
            </Text>
          </Pressable>
        </Gutter>

        {live ? (
          <Gutter className="mb-10">
            <LiveStrip
              order={live}
              onTrack={() => openOrderTracking(navigation, live.id)}
            />
          </Gutter>
        ) : null}

        {categories.length > 0 ? (
          <Gutter className="mb-5">
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
              {categories.map((c) => (
                <Chip
                  key={c}
                  label={titleCase(c)}
                  selected={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
          </Gutter>
        ) : null}

        <Gutter className="mb-4 flex-row items-center justify-between">
          <Text className="font-sans-medium text-heading-sm text-ink">
            {wave ? `On ${wave.name}` : "Open now"}
          </Text>
          <Pressable
            onPress={() => navigation.navigate("ShopSelection", waveDate)}
            accessibilityRole="button"
            className="flex-row items-center gap-1"
          >
            <Text className="font-sans-medium text-body text-ink">See all</Text>
            <ChevronRightIcon size={16} color={colors.ink} strokeWidth={2} />
          </Pressable>
        </Gutter>

        {isLoading ? (
          <CardGrid>
            {Array.from({ length: shopColumns }, (_, i) => (
              <SkeletonCard key={i} width={cardWidth} />
            ))}
          </CardGrid>
        ) : visible.length === 0 ? (
          <Gutter>
            <Text className="font-sans text-body text-muted">
              {category
                ? `No ${titleCase(category)} shops on this Wave.`
                : "No shops are live yet."}
            </Text>
          </Gutter>
        ) : (
          <CardGrid>
            {visible.map((shop) => (
              <ShopTile
                key={shop.id}
                shop={shop}
                width={cardWidth}
                onPress={() =>
                  openShopMenu(navigation, {
                    shopId: shop.id,
                    shopName: shop.name,
                    scheduledDate: waveDate.scheduledDate,
                    isSpecialOrder: waveDate.isSpecialOrder,
                  })
                }
              />
            ))}
          </CardGrid>
        )}

        <Gutter className="mt-12 mb-4">
          <View className="flex-row items-center justify-between rounded-card bg-surface p-5">
            <View className="flex-1 pr-4">
              <Text className="font-sans-medium text-ui text-ink">Can’t find your shop?</Text>
              <Text className="mt-1 font-sans text-body text-muted">
                Suggest it — we’ll send a runner, and popular suggestions get onboarded.
              </Text>
            </View>
            <Button
              label="Suggest a shop"
              variant="ghost"
              full={false}
              onPress={() =>
                navigation.navigate("SuggestShop", {
                  scheduledDate: waveDate.scheduledDate,
                  isSpecialOrder: waveDate.isSpecialOrder,
                })
              }
            />
          </View>
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}

function ShopTile({
  shop,
  width,
  onPress,
}: {
  shop: Shop;
  width: number;
  onPress: () => void;
}) {
  return (
    <PhotoCard
      width={width}
      imageUrl={shop.logoUrl}
      title={shop.name}
      meta={shop.locationText ?? titleCase(shop.category)}
      priceLabel="from"
      priceValue={`${formatGhsCompact(DEFAULT_DELIVERY_FEE_GHS)} delivery`}
      badge={shop.isActive ? undefined : "Paused"}
      onPress={onPress}
    />
  );
}

function LiveStrip({ order, onTrack }: { order: Order; onTrack: () => void }) {
  const pill = statusPill(order.status);
  return (
    <View className="flex-row items-center gap-4 rounded-card bg-surface px-5 py-4">
      <Thumb uri={order.shop?.logoUrl} size={52} />
      <View className="min-w-0 flex-1">
        <View className="mb-1 flex-row items-center gap-2">
          <Text className="font-sans-medium text-ui text-ink" numberOfLines={1}>
            {order.shop?.name ?? "Your order"}
          </Text>
          <StatusPill label={pill.label} tone={pill.tone} />
        </View>
        <Text className="mb-2 font-sans text-body text-muted" numberOfLines={1}>
          To {order.checkpoint?.name ?? "your checkpoint"}
        </Text>
        <ProgressRail ratio={orderProgress(order.status)} />
      </View>
      <Button label="Track" onPress={onTrack} full={false} />
    </View>
  );
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
