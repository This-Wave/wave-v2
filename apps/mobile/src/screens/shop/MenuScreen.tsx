import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { Plus, UtensilsCrossed } from "lucide-react-native";
import type { ProductStatus } from "@wave/shared";
import { Badge } from "../../components/ui/Badge";
import { SearchBar } from "../../components/ui/SearchBar";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useMyShop, useShopProducts, useUpdateProductStatus } from "../../lib/shopOwner";
import { formatGhs } from "../../lib/pricing";

const STATUS_BADGE: Record<ProductStatus, { label: string; variant: "success" | "neutral" | "warning" }> = {
  active: { label: "Active", variant: "success" },
  out_of_stock: { label: "Out of Stock", variant: "neutral" },
  not_serving: { label: "Not Serving", variant: "warning" },
};

const STATUS_CYCLE: Record<ProductStatus, ProductStatus> = {
  active: "out_of_stock",
  out_of_stock: "not_serving",
  not_serving: "active",
};

export function MenuScreen() {
  const { data: shop } = useMyShop();
  const { data: products, isLoading } = useShopProducts(shop?.id);
  const updateStatus = useUpdateProductStatus(shop?.id);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="flex-row items-center justify-between px-6 pb-3 pt-2">
        <Text className="font-sans-extrabold text-[20px] tracking-tight text-ink">Menu</Text>
        <Pressable className="flex-row items-center gap-1.5 rounded-well bg-wave-500 px-3.5 py-2" onPress={() => {}}>
          <Plus size={15} color="#fff" strokeWidth={2.5} />
          <Text className="font-sans-semibold text-[12px] text-white">Add Item</Text>
        </Pressable>
      </View>

      <View className="px-6 pb-3">
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search menu..." />
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 16 }}>
        {isLoading ? (
          <View className="gap-2.5">
            <Skeleton height={62} radius={14} />
            <Skeleton height={62} radius={14} />
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState icon={UtensilsCrossed} title="No items yet" description="Tap “Add Item” to start building your menu." />
        ) : (
          <View className="overflow-hidden rounded-well border border-border bg-surface">
            {filtered.map((product, i) => {
              const dimmed = product.status === "out_of_stock" ? 0.6 : product.status === "not_serving" ? 0.5 : 1;
              return (
                <Pressable
                  key={product.id}
                  onPress={() =>
                    updateStatus.mutate({ productId: product.id, status: STATUS_CYCLE[product.status] })
                  }
                  style={{ opacity: dimmed }}
                  className={`flex-row items-center justify-between px-3.5 py-3.5 ${
                    i < filtered.length - 1 ? "border-b border-surface-muted" : ""
                  }`}
                >
                  <View className="flex-1 pr-3">
                    <Text className="font-sans-semibold text-[13px] text-ink" numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text className="mt-0.5 text-[12px] text-muted">{formatGhs(Number(product.price))}</Text>
                  </View>
                  <Badge {...STATUS_BADGE[product.status]} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
