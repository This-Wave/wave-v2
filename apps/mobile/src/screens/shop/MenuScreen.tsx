import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ProductStatus } from "@wave/shared";
import {
  Empty,
  Field,
  Gutter,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Skeleton,
  StatusPill,
} from "../../components/v6";
import { PlusIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import {
  useCreateProduct,
  useSelectedShop,
  useShopProducts,
  useUpdateProductStatus,
} from "../../lib/shopOwner";
import { ShopSwitcher } from "../../components/shop/ShopSwitcher";
import { AddProductSheet } from "../../components/shop/AddProductSheet";
import { formatGhs } from "../../lib/pricing";

const STATUS_PILL: Record<
  ProductStatus,
  { label: string; tone: "neutral" | "active" | "done" | "danger" }
> = {
  active: { label: "On", tone: "done" },
  out_of_stock: { label: "Out of stock", tone: "neutral" },
  not_serving: { label: "Off", tone: "neutral" },
};

// Tapping a row cycles its state. Three states, one tap target — a picker for
// three mutually exclusive values would cost a sheet per item.
const STATUS_CYCLE: Record<ProductStatus, ProductStatus> = {
  active: "out_of_stock",
  out_of_stock: "not_serving",
  not_serving: "active",
};

export function MenuScreen() {
  const { shop, shops, selectShop } = useSelectedShop();
  const { data: products, isLoading } = useShopProducts(shop?.id);
  const updateStatus = useUpdateProductStatus(shop?.id);
  const createProduct = useCreateProduct(shop?.id);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-5 pt-4">
          <View className="flex-row items-center justify-between">
            <PageTitle>Menu</PageTitle>
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
            <View className="gap-2">
              <Skeleton height={64} radius={12} />
              <Skeleton height={64} radius={12} />
            </View>
          ) : filtered.length === 0 ? (
            <Empty
              title={query ? "Nothing matches" : "No items yet"}
              body={query ? "Try a different word." : "Add your first item to start selling."}
            />
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
                      updateStatus.mutate({
                        productId: product.id,
                        status: STATUS_CYCLE[product.status],
                      })
                    }
                  />
                ))}
              </RowGroup>
              <Text className="mt-3 font-sans text-meta text-muted">
                Tap an item to switch it between on, out of stock, and off.
              </Text>
            </>
          )}
        </Gutter>
      </ScreenBody>

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
