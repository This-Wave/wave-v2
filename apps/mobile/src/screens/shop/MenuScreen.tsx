import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ProductStatus } from "@wave/shared";
import type { Product } from "../../types";
import {
  Empty,
  Field,
  Gutter,
  ListError,
  ListSkeleton,
  PageTitle,
  Screen,
  ScreenBody,
  StatusPill,
} from "../../components/v6";
import { PlusIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { ProductStatusSheet } from "../../components/shop/ProductStatusSheet";
import { ProductFormSheet } from "../../components/shop/ProductFormSheet";
import {
  useCreateProduct,
  useDeleteProduct,
  useSelectedShop,
  useShopProducts,
  useUpdateProduct,
  useUpdateProductStatus,
} from "../../lib/shopOwner";
import { ShopSwitcher } from "../../components/shop/ShopSwitcher";
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
  const updateProduct = useUpdateProduct(shop?.id);
  const deleteProduct = useDeleteProduct(shop?.id);
  const [query, setQuery] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
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

  function openEdit(product: Product) {
    setEditTarget(product);
    setFormMode("edit");
  }

  function closeForm() {
    setFormMode(null);
    setEditTarget(null);
  }

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
              onPress={() => setFormMode("create")}
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
                    onPress={() => openEdit(product)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${product.name}`}
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
                    <Pressable
                      className="w-36"
                      onPress={(event) => {
                        event.stopPropagation?.();
                        setStatusTarget({
                          id: product.id,
                          name: product.name,
                          status: product.status,
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Change status for ${product.name}`}
                    >
                      <StatusPill {...STATUS_PILL[product.status]} />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
              <Text className="mt-3 font-sans text-meta text-muted">
                Click an item to edit name, price, or photo. Click status to change availability.
              </Text>
            </>
          ) : (
            <>
              {/*
                Two sibling controls, not a row with a decorative pill. Marking
                something sold out used to take three taps through the edit
                sheet, and a stock-out that reaches checkout is the worst refund
                Wave has — the student has already paid. Now it is one tap, from
                the screen an owner is already looking at.

                Siblings rather than a pressable inside a pressable: nested
                touchables are ambiguous to assistive tech about which one a tap
                belongs to.
              */}
              <View style={{ gap: 8 }}>
                {filtered.map((product) => (
                  <View
                    key={product.id}
                    className="flex-row items-center gap-3 rounded-card bg-surface px-4 py-3"
                  >
                    <Pressable
                      onPress={() => openEdit(product)}
                      accessibilityRole="button"
                      accessible
                      accessibilityLabel={`${product.name}, ${formatGhs(Number(product.price))}`}
                      accessibilityHint="Edit name, price or photo"
                      className="min-h-[44px] flex-1 justify-center"
                    >
                      <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
                        {product.name}
                      </Text>
                      <Text className="font-sans text-body text-muted">
                        {formatGhs(Number(product.price))}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        setStatusTarget({
                          id: product.id,
                          name: product.name,
                          status: product.status,
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${product.name} is ${STATUS_PILL[product.status].label}. Change availability.`}
                      hitSlop={8}
                      className="min-h-[44px] justify-center"
                    >
                      <StatusPill {...STATUS_PILL[product.status]} />
                    </Pressable>
                  </View>
                ))}
              </View>
              <Text className="mt-3 font-sans text-meta text-muted">
                Tap an item to edit it, or tap its status to mark it sold out.
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

      <ProductFormSheet
        visible={formMode !== null}
        mode={formMode === "edit" ? "edit" : "create"}
        initial={editTarget}
        onClose={closeForm}
        submitting={createProduct.isPending || updateProduct.isPending}
        deleting={deleteProduct.isPending}
        error={
          createProduct.isError || updateProduct.isError
            ? "Could not save the item. Check the details and try again."
            : deleteProduct.isError
              ? "Could not remove the item."
              : null
        }
        onSubmit={(input) => {
          if (formMode === "edit" && editTarget) {
            return updateProduct.mutateAsync({ productId: editTarget.id, input }).then(() => {
              showToast("Item updated.", "success");
            });
          }
          return createProduct.mutateAsync(input).then(() => {
            showToast("Item added.", "success");
          });
        }}
        onDelete={
          formMode === "edit" && editTarget
            ? () =>
                deleteProduct.mutateAsync(editTarget.id).then(() => {
                  showToast("Item removed.", "success");
                })
            : undefined
        }
        onChangeStatus={
          formMode === "edit" && editTarget
            ? () => {
                closeForm();
                setStatusTarget({
                  id: editTarget.id,
                  name: editTarget.name,
                  status: editTarget.status,
                });
              }
            : undefined
        }
      />
    </Screen>
  );
}
