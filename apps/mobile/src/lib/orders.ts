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

/**
 * Re-sends the delivery PIN by SMS.
 *
 * This is the only recovery path for a lost PIN: the plaintext is never stored
 * — the server keeps a bcrypt hash and texts the digits once — so there is
 * nothing for the app to re-read. The endpoint has existed since Phase 3 and
 * had no caller anywhere in the app until the v6 pickup screen.
 *
 * The server throttles to one send per order per 60s and answers 429 with a
 * human-readable wait, which the screen surfaces verbatim.
 */
export function useResendPin() {
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.post<{ sent: boolean }>(`/orders/${orderId}/resend-pin`);
      return data;
    },
  });
}
