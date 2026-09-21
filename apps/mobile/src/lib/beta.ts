import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type BetaStatus = "pending" | "approved" | "rejected" | "revoked";

export interface BetaApplication {
  status: BetaStatus;
  reason: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** This person's beta application, or null if they never applied. */
export function useBetaApplication() {
  return useQuery({
    queryKey: ["beta", "me"],
    queryFn: async () => {
      const { data } = await api.get<{ application: BetaApplication | null }>("/beta/me");
      return data.application;
    },
    staleTime: 60 * 1000,
  });
}

export function useApplyForBeta() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) => {
      const { data } = await api.post<{ application: BetaApplication }>("/beta/apply", {
        reason: reason.trim() || undefined,
      });
      return data.application;
    },
    onSuccess: (application) => client.setQueryData(["beta", "me"], application),
  });
}

export function useSendBetaFeedback() {
  return useMutation({
    mutationFn: async (input: { message: string; screen?: string; appVersion?: string }) => {
      await api.post("/beta/feedback", input);
    },
  });
}
