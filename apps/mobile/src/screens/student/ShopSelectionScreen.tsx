import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, Store } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { SearchBar } from "../../components/ui/SearchBar";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Badge } from "../../components/ui/Badge";
import { useShops } from "../../lib/shops";

function isShopOpen(shop: { openingTime: string | null; closingTime: string | null }): boolean {
  if (!shop.openingTime || !shop.closingTime) return true;
  const now = new Date();
  const open = new Date(shop.openingTime);
  const close = new Date(shop.closingTime);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = open.getUTCHours() * 60 + open.getUTCMinutes();
  const closeMinutes = close.getUTCHours() * 60 + close.getUTCMinutes();
  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
}

export function ShopSelectionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { data: shops, isLoading } = useShops();
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => (shops ?? []).filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [shops, query],
  );

  const canGoBack = navigation.canGoBack();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pb-3.5 pt-1.5">
        <View className="mb-3.5 flex-row items-center gap-3">
          {canGoBack ? <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} /> : null}
          <Text className="font-sans-extrabold text-[17px] tracking-tight text-ink">Buy For Me</Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search shops..." />
      </View>

      <ScrollView className="flex-1 px-6">
        <SectionHeader label="Popular" eyebrow />
        {isLoading ? (
          <Text className="text-[12px] text-muted">Loading shops...</Text>
        ) : filtered.length === 0 ? (
          <Text className="text-[12px] text-muted">No shops found.</Text>
        ) : (
          filtered.map((shop) => {
            const open = isShopOpen(shop);
            return (
              <View
                key={shop.id}
                className={`mb-2 flex-row items-center rounded-well p-3 ${
                  open ? "border border-border" : "border border-border opacity-50"
                }`}
                onTouchEnd={() => open && navigation.navigate("DescribeOrder", { shopId: shop.id, shopName: shop.name })}
              >
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-well bg-surface-muted">
                  <Store size={20} color="#9E9E9E" />
                </View>
                <View className="flex-1">
                  <Text className="mb-0.5 font-sans-bold text-[13px] text-ink">{shop.name}</Text>
                  <Text className="text-[11px] text-muted">{shop.category}</Text>
                </View>
                <Badge label={open ? "Open" : "Closed"} variant={open ? "success" : "neutral"} />
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
