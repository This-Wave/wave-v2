import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
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
} from "../../components/v6";
import { BellIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useShops } from "../../lib/shops";
import { useMyOrders } from "../../lib/orders";
import { formatFullDay, upcomingRunDays } from "../../lib/pricing";
import { orderProgress, statusPill } from "./orderPresenters";
import type { Order, Shop } from "../../types";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

const CARD_W = 168;

/**
 * v6 Home.
 *
 * The reference's central move is that the homepage has no hero image and no
 * headline — the search bar *is* the hero, and everything under it is
 * photography in horizontal rails. This screen is built on that shape.
 *
 * What was removed and why:
 *  - The greeting ("Good morning, Ama") told the student nothing they did not
 *    know and cost the most valuable strip on the screen.
 *  - The 47-hour countdown block. Wave delivers on Sundays and Wednesdays; that
 *    is a schedule, not a countdown. It now appears as one field inside the
 *    search capsule.
 *  - The four circular quick-action tiles, which duplicated the tab bar and the
 *    rails below them.
 */
export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { data: shops, isLoading: shopsLoading } = useShops();
  const { data: orders } = useMyOrders();
  const [category, setCategory] = useState<string | null>(null);

  const nextRun = upcomingRunDays(new Date(), 1)[0];
  const runLabel = nextRun ? formatFullDay(nextRun).replace(",", "") : "Next run";

  // The filter rail is derived from the data, not from an enum — `shop.category`
  // is free text and the seed's distinct values *are* the rail. See PLAN.md.
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
      (orders ?? []).filter((o) => o.status === "delivered").map((o) => o.shopId),
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
        <Gutter className="pb-5 pt-1">
          <SearchCapsule
            runLabel={runLabel}
            onPressQuery={() => navigation.navigate("ShopSelection")}
            onPressRun={() => navigation.navigate("ShopSelection")}
            onSubmit={() => navigation.navigate("ShopSelection")}
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

        {live ? <LiveOrderCard order={live} onPress={() => open(navigation, live)} /> : null}

        <Section
          title={`Open for ${nextRun ? shortDay(nextRun) : "the next run"}`}
          loading={shopsLoading}
          shops={visible}
          navigation={navigation}
          emptyNote={category ? `No ${titleCase(category)} shops on this run.` : undefined}
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
 * The live order strip. Replaces v5's "Active orders" list: a student has at
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

function open(navigation: Nav, order: Order) {
  navigation.navigate("OrderTracking", { orderId: order.id });
}

function shortDay(d: Date): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
