import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubmitVerificationInput } from "@wave/shared";
import { api } from "./api";
import type { Order, RiderEarning, RiderVerification } from "../types";

export function useAvailableOrders() {
  return useQuery({
    queryKey: ["orders", "available"],
    queryFn: async () => {
      const { data } = await api.get<{ orders: Order[] }>("/orders/available");
      return data.orders;
    },
    // Back to 10s now the Realtime broadcast is gone (2026-08-03): this poll is
    // the only thing that surfaces a new order to an open feed, so it carries
    // the latency the broadcast used to hide.
    refetchInterval: 10_000,
  });
}

export function useMyDeliveries() {
  return useQuery({
    queryKey: ["orders", "my-deliveries"],
    queryFn: async () => {
      const { data } = await api.get<{ orders: Order[] }>("/orders/my-deliveries");
      return data.orders;
    },
  });
}

export function useAcceptOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.patch<{ order: Order }>(`/orders/${orderId}/accept`);
      return data.order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, status, note }: { orderId: string; status: string; note?: string }) => {
      const { data } = await api.patch<{ order: Order }>(`/orders/${orderId}/status`, { status, note });
      return data.order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useDeliverOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, pin }: { orderId: string; pin: string }) => {
      const { data } = await api.patch<{ order: Order }>(`/orders/${orderId}/deliver`, { pin });
      return data.order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["riders", "earnings"] });
    },
  });
}

export function useRiderEarnings() {
  return useQuery({
    queryKey: ["riders", "earnings"],
    queryFn: async () => {
      const { data } = await api.get<{ earnings: RiderEarning[] }>("/riders/earnings");
      return data.earnings;
    },
  });
}

export function useSetAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isAvailable: boolean) => {
      const { data } = await api.patch<{ profile: unknown }>("/riders/availability", { isAvailable });
      return data.profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "available"] });
    },
  });
}

export function useVerificationStatus() {
  return useQuery({
    queryKey: ["riders", "verification"],
    queryFn: async () => {
      const { data } = await api.get<{ verification: RiderVerification | null }>("/riders/verification/status");
      return data.verification;
    },
  });
}

export function useSubmitVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitVerificationInput) => {
      const { data } = await api.post<{ verification: RiderVerification }>("/riders/verification", input);
      return data.verification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["riders", "verification"] });
    },
  });
}

export function useUploadVerificationImage() {
  return useMutation({
    mutationFn: async ({
      kind,
      base64,
      contentType,
    }: {
      kind: "id" | "selfie";
      base64: string;
      contentType: "image/jpeg" | "image/png" | "image/webp";
    }) => {
      // Returns the object's Storage path, which is what POST /verification
      // stores. Signed URLs are minted per read, never persisted.
      const { data } = await api.post<{ path: string }>("/riders/verification/upload", {
        kind,
        imageBase64: base64,
        contentType,
      });
      return data.path;
    },
  });
}

/**
 * Records what the rider actually paid, per item, at a shop with no Wave menu.
 *
 * Only valid on a `shop_pickup`, and only once — the server refuses a second
 * submission because the student may already have been charged against the
 * first. See `POST /orders/:id/goods-cost`.
 */
export function useRecordGoodsCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      lines,
    }: {
      orderId: string;
      lines: { itemId: string; actualUnitPrice: number }[];
    }) => {
      const { data } = await api.post<{ order: Order; goodsTotal: number }>(
        `/orders/${orderId}/goods-cost`,
        { lines },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
