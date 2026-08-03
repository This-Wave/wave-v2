import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { SearchBar } from "../../components/ui/SearchBar";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { ImagePlaceholder } from "../../components/ui/ImagePlaceholder";
import { CartIcon, ChevronRightIcon, ElectronicsIcon, PharmacyIcon, PinIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
import { useShops } from "../../lib/shops";
import type { Shop } from "../../types";

const ALL = "All";

function categoryIcon(category: string, active: boolean) {
  const color = active ? colors.lime : colors.ink;
  const key = category.toLowerCase();
  if (key === ALL.toLowerCase()) return <PinIcon size={22} color={color} />;
  if (key.includes("electr")) return <ElectronicsIcon size={22} color={color} />;
  if (key.includes("pharm") || key.includes("health")) return <PharmacyIcon size={22} color={color} />;
  return <CartIcon size={22} color={color} strokeWidth={1.6} />;
}

function isShopOpen(shop: Pick<Shop, "openingTime" | "closingTime">): boolean {
  if (!shop.openingTime || !shop.closingTime) return true;
  const now = new Date();
  const open = new Date(shop.openingTime);
  const close = new Date(shop.closingTime);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = open.getUTCHours() * 60 + open.getUTCMinutes();
  const closeMinutes = close.getUTCHours() * 60 + close.getUTCMinutes();
  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
}

/**
 * v5 screen 14 "Shops". Title + search, the round-tile category rail (active
 * tile goes solid green with a lime glyph), a featured-deal carousel, then the
 * full shop list. Doubles as the pushed "Buy For Me" shop picker, in which case
 * it gets the stack header instead of the page title.
 */
export function ShopSelectionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { data: shops, isLoading } = useShops();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);

  const categories = useMemo(() => {
    const unique = Array.from(new Set((shops ?? []).map((s) => s.category))).filter(Boolean);
    return [ALL, ...unique];
  }, [shops]);

  const filtered = useMemo(
    () =>
      (shops ?? []).filter((shop) => {
        if (category !== ALL && shop.category !== category) return false;
        return shop.name.toLowerCase().includes(query.toLowerCase());
      }),
    [shops, query, category],
  );

  const featured = (shops ?? []).filter((s) => s.isVerified).slice(0, 4);
  const isPushed = navigation.canGoBack();

  function openShop(shop: Shop) {
    if (!isShopOpen(shop)) return;
    navigation.navigate("DescribeOrder", { shopId: shop.id, shopName: shop.name });
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      {isPushed ? (
        <ScreenHeader title="Buy For Me" onBack={() => navigation.goBack()} />
      ) : null}

      <View className="px-5 pb-4 pt-4">
        {!isPushed ? (
          <Text className="mb-3.5 font-sans-semibold text-[24px] tracking-tight text-ink">Shops</Text>
        ) : null}
        <SearchBar value={query} onChangeText={setQuery} />
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: isPushed ? 24 : 128 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader label="Categories" eyebrow />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {categories.map((name) => {
            const active = category === name;
            return (
              <Pressable key={name} className="min-w-[60px] items-center gap-2" onPress={() => setCategory(name)}>
                <View
                  className={`h-14 w-14 items-center justify-center rounded-control ${
                    active ? "bg-wave-500" : "border border-border bg-surface"
                  }`}
                >
                  {categoryIcon(name, active)}
                </View>
                <Text className="font-sans-medium text-[11px] capitalize text-ink" numberOfLines={1}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {featured.length > 0 ? (
          <View className="mt-6">
            <SectionHeader label="Featured shops" eyebrow />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {featured.map((shop) => (
                <Pressable
                  key={shop.id}
                  className="min-w-[176px] overflow-hidden rounded-card border border-border bg-surface"
                  style={shadowCard}
                  onPress={() => openShop(shop)}
                >
                  <View>
                    <ImagePlaceholder uri={shop.logoUrl} height={96} radius={0} />
                    <View className="absolute left-2 top-2 rounded-pill bg-wave-lime px-2.5 py-1">
                      <Text className="font-sans-semibold text-[11px] text-wave-500">Verified</Text>
                    </View>
                  </View>
                  <View className="px-3 py-2.5">
                    <Text className="font-sans-semibold text-[13px] text-ink" numberOfLines={1}>
                      {shop.name}
                    </Text>
                    <Text className="text-[11px] capitalize text-muted" numberOfLines={1}>
                      {shop.category}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View className="mt-6">
          <SectionHeader label="All shops" eyebrow />
          {isLoading ? (
            <Text className="text-[13px] text-muted">Loading shops…</Text>
          ) : filtered.length === 0 ? (
            <Text className="text-[13px] text-muted">No shops found.</Text>
          ) : (
            filtered.map((shop) => {
              const open = isShopOpen(shop);
              return (
                <Pressable
                  key={shop.id}
                  className={`mb-2.5 flex-row items-center gap-3 rounded-card border border-border bg-surface p-3 ${
                    open ? "" : "opacity-50"
                  }`}
                  onPress={() => openShop(shop)}
                >
                  <ImagePlaceholder uri={shop.logoUrl} width={48} height={48} radius={14} />
                  <View className="flex-1">
                    <Text className="font-sans-semibold text-[14px] text-ink" numberOfLines={1}>
                      {shop.name}
                    </Text>
                    <Text className="text-[12px] capitalize text-muted" numberOfLines={1}>
                      {shop.category}
                      {open ? "" : " · Closed"}
                    </Text>
                  </View>
                  <ChevronRightIcon />
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
