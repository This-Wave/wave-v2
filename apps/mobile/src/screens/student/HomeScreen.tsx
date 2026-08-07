import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  BrandBar,
  CardRail,
  Chip,
  IconCircle,
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
import { BellIcon, BoxIcon, CartIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useShops } from "../../lib/shops";
import { useMyOrders } from "../../lib/orders";
import { useWave } from "../../lib/wave";
import { orderProgress, statusPill } from "./orderPresenters";
import type { Order, Shop } from "../../types";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

const CARD_W = 168;

/**
 * v6 Home.
 *
 * Built on the reference's central move — no hero image, no headline, the
 * search is the hero — with two Wave-specific additions above it:
 *
 *  1. The Wave countdown. Deliveries go out on a schedule, and the deadline to
 *     join one is genuinely the most actionable fact on the screen.
 *  2. Both services. v5's hero offered "Buy For Me" and "Pickup"; the first v6
 *     pass dropped Pickup entirely, which silently removed half the product.
 *
 * What stays gone from v5: the greeting, the 40px countdown block that treated
 * a twice-weekly schedule as an emergency, and the four circular quick-action
 * tiles that duplicated the tab bar.
 */
export function HomeScreen() {
  const navigation = useNavigation<Nav>();
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
      <BrandBar
        trailing={
          <IconCircle accessibilityLabel="Notifications">
            <BellIcon size={18} color={colors.ink} strokeWidth={1.7} />
          </IconCircle>
        }
      />

      <ScreenBody bottomInset={32}>
        <Gutter className="pb-4 pt-1">
          {wave && !wave.closed ? (
            <WaveBanner wave={wave} onPress={() => navigation.navigate("ShopSelection")} />
          ) : (
            <WaveClosedBanner onPress={() => navigation.navigate("CutoffPassed")} />
          )}
        </Gutter>

        <Gutter className="pb-4">
          <SearchCapsule
            waveLabel={wave?.dateLabel ?? "Next Wave"}
            onPressQuery={() => navigation.navigate("ShopSelection")}
            onPressWave={() => navigation.navigate("ShopSelection")}
            onSubmit={() => navigation.navigate("ShopSelection")}
          />
        </Gutter>

        {/* Both services, equally weighted. Wave does two things and the home
            screen has to say so. */}
        <Gutter className="mb-6 flex-row gap-3">
          <ServiceTile
            icon={<CartIcon size={20} color={colors.ink} strokeWidth={1.7} />}
            title="Buy for me"
            meta="We shop and bring it"
            onPress={() => navigation.navigate("ShopSelection")}
          />
          <ServiceTile
            icon={<BoxIcon size={20} color={colors.ink} strokeWidth={1.7} />}
            title="Pickup"
            meta="Move a package"
            onPress={() => navigation.navigate("PickupRequest")}
          />
        </Gutter>

        {categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
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
            onPress={() => navigation.navigate("OrderTracking", { orderId: live.id })}
          />
        ) : null}

        <Section
          title={wave ? `On ${wave.name}` : "Open now"}
          loading={shopsLoading}
          shops={visible}
          navigation={navigation}
          emptyNote={category ? `No ${titleCase(category)} shops on this Wave.` : undefined}
        />

        {orderedBefore.length > 0 ? (
          <Section
            title="You ordered before"
            loading={false}
            shops={orderedBefore}
            navigation={navigation}
          />
        ) : null}
      </ScreenBody>
    </Screen>
  );
}

function ServiceTile({
  icon,
  title,
  meta,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 rounded-card bg-surface p-4 active:bg-hairline"
    >
      <View className="mb-3">{icon}</View>
      <Text className="font-sans-medium text-body text-ink">{title}</Text>
      <Text className="font-sans text-body text-muted" numberOfLines={1}>
        {meta}
      </Text>
    </Pressable>
  );
}

function Section({
  title,
  shops,
  loading,
  navigation,
  emptyNote,
}: {
  title: string;
  shops: Shop[];
  loading: boolean;
  navigation: Nav;
  emptyNote?: string;
}) {
  return (
    <View className="mb-section">
      <Gutter className="mb-3">
        <SectionTitle title={title} onPress={() => navigation.navigate("ShopSelection")} />
      </Gutter>

      {loading ? (
        <CardRail>
          <SkeletonCard width={CARD_W} />
          <SkeletonCard width={CARD_W} />
        </CardRail>
      ) : shops.length === 0 ? (
        <Gutter>
          <Text className="font-sans text-body text-muted">
            {emptyNote ?? "Nothing here yet."}
          </Text>
        </Gutter>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <CardRail>
            {shops.map((shop) => (
              <PhotoCard
                key={shop.id}
                width={CARD_W}
                imageUrl={shop.logoUrl}
                title={shop.name}
                meta={shop.locationText ?? titleCase(shop.category)}
                priceLabel="from"
                priceValue="GH₵5 delivery"
                badge={shop.isActive ? undefined : "Paused"}
                onPress={() =>
                  navigation.navigate("DescribeOrder", { shopId: shop.id, shopName: shop.name })
                }
              />
            ))}
          </CardRail>
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
