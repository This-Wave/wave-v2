import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateOrderInput } from "@wave/shared";
import { api } from "./api";
import type { Order } from "../types";

export function useMyOrders() {
  return useQuery({
    queryKey: ["orders", "my"],
    queryFn: async () => {
      const { data } = await api.get<{ orders: Order[] }>("/orders/my");
      return data.orders;
    },
  });
}

export function useOrder(orderId: string | undefined, options?: { poll?: boolean }) {
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: async () => {
      const { data } = await api.get<{ order: Order }>(`/orders/${orderId}`);
      return data.order;
    },
    enabled: !!orderId,
    refetchInterval: options?.poll ? 5000 : undefined,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const { data } = await api.post<{ order: Order }>("/orders", input);
      return data.order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
