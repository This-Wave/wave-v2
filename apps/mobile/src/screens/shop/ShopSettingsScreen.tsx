import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { Clock, LogOut, MapPin, Store } from "lucide-react-native";
import { Card } from "../../components/ui/Card";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { ListRow } from "../../components/ui/ListRow";
import { useMyShop, useSetShopServing } from "../../lib/shopOwner";
import { signOut } from "../../lib/auth";

export function ShopSettingsScreen() {
  const { data: shop } = useMyShop();
  const setServing = useSetShopServing(shop?.id);

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView className="flex-1 px-6 pt-3" contentContainerStyle={{ paddingBottom: 128 }}>
        <Card className="mb-3 bg-surface">
          <View className="mb-3 flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-well bg-surface-muted">
              <Store size={20} color="#6B7D63" />
            </View>
            <View className="flex-1">
              <Text className="font-sans-extrabold text-[16px] text-ink">{shop?.name ?? "Your Shop"}</Text>
              <Text className="mt-0.5 text-[11px] text-muted">{shop?.category ?? "—"}</Text>
            </View>
          </View>
          {shop?.locationText ? (
            <View className="mb-1.5 flex-row items-center gap-2">
              <MapPin size={13} color="#6B7D63" />
              <Text className="text-[12px] text-muted">{shop.locationText}</Text>
            </View>
          ) : null}
          {shop?.openingTime && shop?.closingTime ? (
            <View className="flex-row items-center gap-2">
              <Clock size={13} color="#6B7D63" />
              <Text className="text-[12px] text-muted">
                {shop.openingTime} – {shop.closingTime}
              </Text>
            </View>
          ) : null}
        </Card>

        <Card className="mb-3 flex-row items-center justify-between bg-surface">
          <View className="flex-1 pr-3">
            <Text className="font-sans-bold text-[13px] text-ink">Serving</Text>
            <Text className="mt-0.5 text-[11px] text-muted">
              {setServing.isError
                ? "Could not update — check your connection and try again."
                : shop?.isActive === false
                  ? "Paused. Students cannot see your shop."
                  : "Toggle off to pause new orders"}
            </Text>
          </View>
          <ToggleSwitch
            value={shop?.isActive ?? false}
            disabled={!shop || setServing.isPending}
            onValueChange={(next) => setServing.mutate(next)}
          />
        </Card>

        <View className="overflow-hidden rounded-well border border-border bg-surface">
          <ListRow leading={<LogOut size={18} color="#B3453A" />} title="Log Out" danger onPress={() => signOut()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
