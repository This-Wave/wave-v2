import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProductInput, ProductStatus } from "@wave/shared";
import { api } from "./api";
import type { Order, Product, Shop } from "../types";

export function useMyShop() {
  return useQuery({
    queryKey: ["shops", "my"],
    queryFn: async () => {
      const { data } = await api.get<{ shop: Shop | null }>("/shops/my");
      return data.shop;
    },
  });
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
      const previous = queryClient.getQueryData<Shop | null>(["shops", "my"]);
      queryClient.setQueryData<Shop | null>(["shops", "my"], (s) => (s ? { ...s, isActive } : s));
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
