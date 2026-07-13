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
