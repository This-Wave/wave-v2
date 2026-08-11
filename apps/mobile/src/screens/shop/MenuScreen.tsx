import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ProductStatus } from "@wave/shared";
import {
  Empty,
  Field,
  Gutter,
  ListError,
  ListSkeleton,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  StatusPill,
} from "../../components/v6";
import { PlusIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { ProductStatusSheet } from "../../components/shop/ProductStatusSheet";
import {
  useCreateProduct,
  useSelectedShop,
  useShopProducts,
  useUpdateProductStatus,
} from "../../lib/shopOwner";
import { ShopSwitcher } from "../../components/shop/ShopSwitcher";
import { AddProductSheet } from "../../components/shop/AddProductSheet";
import { useLayout } from "../../hooks/useLayout";
import { formatGhs } from "../../lib/pricing";
import { showToast } from "../../store/toastStore";

const STATUS_PILL: Record<
  ProductStatus,
  { label: string; tone: "neutral" | "active" | "done" | "danger" }
> = {
  active: { label: "On", tone: "done" },
  out_of_stock: { label: "Out of stock", tone: "neutral" },
  not_serving: { label: "Off", tone: "neutral" },
};

export function MenuScreen() {
  const { shop, shops, selectShop } = useSelectedShop();
  const { data: products, isLoading, isError, refetch, isRefetching } = useShopProducts(shop?.id);
  const updateStatus = useUpdateProductStatus(shop?.id);
  const createProduct = useCreateProduct(shop?.id);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{
    id: string;
    name: string;
    status: ProductStatus;
  } | null>(null);
  const { isDesktop } = useLayout();

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <Screen>
      <ScreenBody
        bottomInset={24}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      >
        <Gutter className={isDesktop ? "pb-6 pt-8" : "pb-5 pt-4"}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              {isDesktop ? (
                <>
                  <Text className="font-sans-bold text-heading text-ink">Menu</Text>
                  <Text className="mt-1 font-sans text-ui text-muted">
                    What students can order from {shop?.name ?? "your shop"}.
                  </Text>
                </>
              ) : (
                <PageTitle>Menu</PageTitle>
              )}
            </View>
            <Pressable
              disabled={!shop}
              onPress={() => setAdding(true)}
              accessibilityRole="button"
              accessibilityLabel="Add an item"
              className={`h-11 flex-row items-center gap-1.5 rounded-pill px-4 ${
                shop ? "bg-lime active:bg-lime-600" : "bg-surface-muted"
              }`}
            >
              <PlusIcon size={16} color={colors.ink} strokeWidth={2.2} />
              <Text className="font-sans-medium text-body text-ink">Add</Text>
            </Pressable>
          </View>
        </Gutter>

        {shops && shops.length > 1 ? (
          <Gutter className="mb-5">
            <ShopSwitcher shops={shops} selectedId={shop?.id} onSelect={selectShop} />
          </Gutter>
        ) : null}

        <Gutter className="mb-5">
          <Field label="" value={query} onChangeText={setQuery} placeholder="Search your menu" />
        </Gutter>

        <Gutter>
          {isLoading ? (
            <ListSkeleton rows={4} />
          ) : isError ? (
            <ListError onRetry={() => void refetch()} />
          ) : filtered.length === 0 ? (
            <Empty
              title={query ? "Nothing matches" : "No items yet"}
              body={query ? "Try a different word." : "Add your first item to start selling."}
            />
          ) : isDesktop ? (
            <>
              <View className="overflow-hidden rounded-card bg-surface">
                <View className="flex-row border-b border-hairline px-5 py-3">
                  <Text className="flex-[2] font-sans-semibold text-meta text-muted">ITEM</Text>
                  <Text className="flex-1 font-sans-semibold text-meta text-muted">PRICE</Text>
                  <Text className="w-36 font-sans-semibold text-meta text-muted">STATUS</Text>
                </View>
                {filtered.map((product, i) => (
                  <Pressable
                    key={product.id}
                    onPress={() =>
                      setStatusTarget({
                        id: product.id,
                        name: product.name,
                        status: product.status,
                      })
                    }
                    accessibilityRole="button"
                    className={`flex-row items-center px-5 py-4 active:bg-canvas ${
                      i === filtered.length - 1 ? "" : "border-b border-hairline"
                    }`}
                  >
                    <Text
                      className="flex-[2] pr-3 font-sans-medium text-body text-ink"
                      numberOfLines={1}
                    >
                      {product.name}
                    </Text>
                    <Text className="flex-1 font-sans text-body text-muted">
                      {formatGhs(Number(product.price))}
                    </Text>
                    <View className="w-36">
                      <StatusPill {...STATUS_PILL[product.status]} />
                    </View>
                  </Pressable>
                ))}
              </View>
              <Text className="mt-3 font-sans text-meta text-muted">
                Click an item to change whether it is on the menu.
              </Text>
            </>
          ) : (
            <>
              <RowGroup>
                {filtered.map((product) => (
                  <Row
                    key={product.id}
                    title={product.name}
                    meta={formatGhs(Number(product.price))}
                    chevron={false}
                    trailing={<StatusPill {...STATUS_PILL[product.status]} />}
                    onPress={() =>
                      setStatusTarget({
                        id: product.id,
                        name: product.name,
                        status: product.status,
                      })
                    }
                  />
                ))}
              </RowGroup>
              <Text className="mt-3 font-sans text-meta text-muted">
                Tap an item to change whether it is on the menu.
              </Text>
            </>
          )}
        </Gutter>
      </ScreenBody>

      <ProductStatusSheet
        visible={!!statusTarget}
        productName={statusTarget?.name ?? ""}
        current={statusTarget?.status ?? "active"}
        onClose={() => setStatusTarget(null)}
        onSelect={(status) => {
          if (!statusTarget) return;
          updateStatus.mutate(
            { productId: statusTarget.id, status },
            {
              onSuccess: () => showToast("Menu updated.", "success"),
              onError: () => showToast("Could not update item.", "danger"),
            },
          );
        }}
      />

      <AddProductSheet
        visible={adding}
        onClose={() => setAdding(false)}
        submitting={createProduct.isPending}
        error={
          createProduct.isError ? "Could not save the item. Check the details and try again." : null
        }
        onSubmit={(input) => createProduct.mutateAsync(input)}
      />
    </Screen>
  );
}
