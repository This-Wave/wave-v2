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

/** Student cancels their own order (refund when already paid). */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { data } = await api.patch<{ order: Order; refundIssued: boolean }>(
        `/orders/${orderId}/cancel`,
        { reason },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
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
 * Fetches the student's delivery PIN for in-app display.
 * Server keeps a bcrypt hash for rider verify + an encrypted copy for this.
 */
export function useDeliveryPin(orderId: string | undefined, options?: { pollUntilReady?: boolean }) {
  return useQuery({
    queryKey: ["orders", orderId, "delivery-pin"],
    queryFn: async () => {
      const { data } = await api.get<{ pin: string }>(`/orders/${orderId}/delivery-pin`);
      return data.pin;
    },
    enabled: !!orderId,
    staleTime: 60_000,
    // Right after pay, webhook may still be confirming — retry briefly.
    retry: options?.pollUntilReady ? 5 : 1,
    retryDelay: 1500,
    refetchInterval: (query) =>
      options?.pollUntilReady && !query.state.data ? 2000 : false,
  });
}

/**
 * Re-issues the delivery PIN, texts it, and returns the digits so the screen
 * can refresh. Throttled to one SMS per order per 60s (429 with wait copy).
 */
export function useResendPin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.post<{ sent: boolean; pin: string }>(
        `/orders/${orderId}/resend-pin`,
      );
      return data;
    },
    onSuccess: (data, orderId) => {
      queryClient.setQueryData(["orders", orderId, "delivery-pin"], data.pin);
    },
  });
}

/**
 * How many deliveries this student has completed — the number the loyalty
 * discount is keyed on.
 *
 * Derived by counting `delivered` orders rather than fetching a dedicated
 * endpoint, because that is exactly what the server's
 * `StudentDeliveryStats.totalDeliveries` counts. It is used ONLY to make the
 * checkout estimate agree with what will actually be charged; the server
 * recalculates from its own stats row and its number is the one billed.
 *
 * Without this every summary screen quoted the undiscounted price to a loyal
 * student — over-quoting rather than under-quoting, but still a total that
 * changed between the review screen and the receipt.
 */
export function useCompletedDeliveryCount(): number {
  const { data: orders } = useMyOrders();
  return (orders ?? []).filter((o) => o.status === "delivered").length;
}
