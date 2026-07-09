import { useMutation } from "@tanstack/react-query";
import { api } from "./api";

interface InitiatePaymentResponse {
  payment_url: string;
  reference: string;
}

export function useInitiatePayment() {
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.post<InitiatePaymentResponse>("/payments/initiate", { orderId });
      return data;
    },
  });
}
