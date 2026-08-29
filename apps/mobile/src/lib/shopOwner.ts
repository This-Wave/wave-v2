import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProductInput, ProductStatus } from "@wave/shared";
import { api } from "./api";
import type { Order, Product, Shop } from "../types";
import { useShopStore } from "../store/shopStore";

/**
 * Every shop this owner holds. An owner may have more than one (product
 * decision, 2026-08-04), so this is a list — the API orders it by name, which is
 * what makes "the first one" a stable default rather than an arbitrary row.
 */
export function useMyShops() {
  return useQuery({
    queryKey: ["shops", "my"],
    queryFn: async () => {
      const { data } = await api.get<{ shops: Shop[] }>("/shops/my");
      return data.shops;
    },
  });
}

/**
 * The shop the shop-side screens are currently acting on, plus everything needed
 * to switch between them.
 *
 * Falls back to the first shop when nothing is selected, and also when the
 * selected id is no longer in the list — otherwise deleting or losing access to
 * a shop would leave every shop screen blank with no way to recover.
 */
export function useSelectedShop() {
  const { data: shops, isLoading } = useMyShops();
  const selectedShopId = useShopStore((s) => s.selectedShopId);
  const setSelectedShopId = useShopStore((s) => s.setSelectedShopId);

  const shop = shops?.find((s) => s.id === selectedShopId) ?? shops?.[0] ?? null;

  return {
    shop,
    shops: shops ?? [],
    isLoading,
    hasMultiple: (shops?.length ?? 0) > 1,
    selectShop: setSelectedShopId,
  };
}

/**
 * Pause or resume the storefront. Optimistic: the toggle should move under the
 * owner's thumb, not after a round trip — but it rolls back and refetches if the
 * request fails, so the switch can never sit in a state the server disagrees with.
 */
export function useSetShopServing(shopId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isActive: boolean) => {
      const { data } = await api.put<{ shop: Shop }>(`/shops/${shopId}`, { isActive });
      return data.shop;
    },
    onMutate: async (isActive) => {
      await queryClient.cancelQueries({ queryKey: ["shops", "my"] });
      const previous = queryClient.getQueryData<Shop[]>(["shops", "my"]);
      // Patch only the shop being toggled — the cache holds every shop this
      // owner has, so a blanket update would flip all of them at once.
      queryClient.setQueryData<Shop[]>(["shops", "my"], (shops) =>
        shops?.map((s) => (s.id === shopId ? { ...s, isActive } : s)),
      );
      return { previous };
    },
    onError: (_err, _isActive, context) => {
      queryClient.setQueryData(["shops", "my"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shops", "my"] });
    },
  });
}

export function useShopOrders() {
  return useQuery({
    queryKey: ["orders", "shop"],
    queryFn: async () => {
      const { data } = await api.get<{ orders: Order[] }>("/orders/shop");
      return data.orders;
    },
    refetchInterval: 10000,
  });
}

export function useShopAcceptOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.patch<{ order: Order }>(`/orders/${orderId}/shop-accept`);
      return data.order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "shop"] });
    },
  });
}

export function useShopCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { data } = await api.patch<{ order: Order }>(`/orders/${orderId}/shop-cancel`, { reason });
      return data.order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "shop"] });
    },
  });
}

export function useShopProducts(shopId: string | undefined) {
  return useQuery({
    queryKey: ["products", shopId],
    queryFn: async () => {
      const { data } = await api.get<{ products: Product[] }>(`/shops/${shopId}/products`);
      return data.products;
    },
    enabled: !!shopId,
  });
}

export function useCreateProduct(shopId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const { data } = await api.post<{ product: Product }>(`/shops/${shopId}/products`, input);
      return data.product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });
}

export function useUpdateProductStatus(shopId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, status }: { productId: string; status: ProductStatus }) => {
      const { data } = await api.patch<{ product: Product }>(`/products/${productId}/status`, { status });
      return data.product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });
}

export function useUpdateProduct(shopId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      input,
    }: {
      productId: string;
      input: Partial<CreateProductInput>;
    }) => {
      const { data } = await api.put<{ product: Product }>(`/products/${productId}`, input);
      return data.product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });
}

export function useDeleteProduct(shopId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      await api.delete(`/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });
}
