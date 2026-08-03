import { useMemo } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { CountdownCard } from "../../components/ui/CountdownCard";
import { HeroAction } from "../../components/ui/HeroAction";
import { QuickAction } from "../../components/ui/QuickAction";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Badge } from "../../components/ui/Badge";
import { IconButton } from "../../components/ui/IconButton";
import { Avatar } from "../../components/ui/Avatar";
import { ImagePlaceholder } from "../../components/ui/ImagePlaceholder";
import { HomeSkeleton } from "./HomeSkeleton";
import { BellIcon, BoxIcon, CardIcon, CartIcon, HistoryIcon, PinDotIcon, PinIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
import { useAuthStore } from "../../store/authStore";
import { useMyOrders } from "../../lib/orders";
import { useShops } from "../../lib/shops";
import { formatFullDay, isCutoffPassedToday, nextRunCutoff } from "../../lib/pricing";
import { initialsOf, shortOrderRef, statusBadge } from "./orderPresenters";
import type { OrderStatus } from "../../types";

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "payment_pending",
  "confirmed",
  "rider_assigned",
  "en_route",
  "at_checkpoint",
];

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * v5 screen 04. Greeting row, the solid-green countdown hero with its lime
 * Buy For Me / outlined Pickup pair, a four-up quick-action rail, then the
 * active-order and nearby-shop sections. The floating tab bar overlaps the
 * scroll view, so the content pads 128px at the bottom (per the design).
 */
export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: orders, isLoading } = useMyOrders();
  const { data: shops } = useShops();

  const cutoff = useMemo(() => nextRunCutoff(), []);
  const activeOrder = orders?.find((o) => ACTIVE_STATUSES.includes(o.status));
  const nearbyShops = shops?.slice(0, 4) ?? [];

  function handleBuyForMe() {
    if (isCutoffPassedToday()) {
      navigation.navigate("CutoffPassed");
      return;
    }
    navigation.navigate("ShopSelection");
  }

  if (isLoading) {
    return <HomeSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 128 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <Avatar initials={profile ? initialsOf(profile.fullName) : undefined} size={40} />
            <View>
              <Text className="font-sans-medium text-[12px] text-muted">{greeting()}</Text>
              <Text className="font-sans-semibold text-[15px] text-ink">{profile?.fullName ?? "Student"}</Text>
            </View>
          </View>
          <IconButton>
            <BellIcon />
          </IconButton>
        </View>

        <View className="mb-5">
          <CountdownCard dayLabel={formatFullDay(cutoff)} cutoffAt={cutoff}>
            <HeroAction
              primary
              label="Buy For Me"
              icon={<CartIcon color={colors.primary} />}
              onPress={handleBuyForMe}
            />
            <HeroAction
              label="Pickup"
              icon={<PinIcon color={colors.white} />}
              onPress={() => navigation.navigate("PickupRequest")}
            />
          </CountdownCard>
        </View>

        <View className="mb-6 flex-row justify-between">
          <QuickAction
            label="Track"
            icon={<BoxIcon />}
            onPress={() =>
              activeOrder
                ? navigation.navigate("OrderTracking", { orderId: activeOrder.id })
                : navigation.navigate("Tabs", { screen: "Orders" })
            }
          />
          <QuickAction
            label="Shops"
            icon={<PinDotIcon />}
            onPress={() => navigation.navigate("Tabs", { screen: "Shops" })}
          />
          <QuickAction
            label="History"
            icon={<HistoryIcon />}
            onPress={() => navigation.navigate("Tabs", { screen: "Orders" })}
          />
          <QuickAction label="Pay" icon={<CardIcon />} onPress={() => navigation.navigate("PaymentMethods")} />
        </View>

        {activeOrder ? (
          <>
            <SectionHeader
              label="Active orders"
              actionLabel="View all"
              onActionPress={() => navigation.navigate("Tabs", { screen: "Orders" })}
            />
            <Pressable
              className="mb-6 flex-row items-center gap-3 rounded-card border border-border bg-surface p-4"
              style={shadowCard}
              onPress={() => navigation.navigate("OrderTracking", { orderId: activeOrder.id })}
            >
              <ImagePlaceholder uri={activeOrder.shop?.logoUrl} width={42} height={42} radius={14} />
              <View className="flex-1">
                <Text className="font-sans-semibold text-[14px] text-ink" numberOfLines={1}>
                  {activeOrder.shop?.name ?? "Shop"} · Buy For Me
                </Text>
                <Text className="text-[12px] text-muted">Order {shortOrderRef(activeOrder.id)}</Text>
              </View>
              <Badge {...statusBadge(activeOrder.status)} />
            </Pressable>
          </>
        ) : null}

        <SectionHeader
          label="Shops near you"
          actionLabel="See all"
          onActionPress={() => navigation.navigate("Tabs", { screen: "Shops" })}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {nearbyShops.length === 0 ? (
            <Text className="text-[12px] text-muted">No shops listed yet.</Text>
          ) : (
            nearbyShops.map((shop) => (
              <Pressable
                key={shop.id}
                className="min-w-[132px] rounded-card border border-border bg-surface p-3.5"
                onPress={() => navigation.navigate("DescribeOrder", { shopId: shop.id, shopName: shop.name })}
              >
                <Text className="font-sans-semibold text-[15px] text-ink">{shop.name}</Text>
                <Text className="mt-[3px] text-[11px] text-muted">{shop.category}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}
