import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { api } from "./api";

/**
 * Mobile Money through Moolre (since 2026-11-20): the student types their
 * number, picks the network, and approves a prompt on their phone. Card stays
 * on Paystack's page (see `PaystackCheckout`).
 */

export type MomoNetwork = "MTN" | "TELECEL" | "AT";

export const MOMO_NETWORKS: { id: MomoNetwork; label: string; ussd: string }[] = [
  { id: "MTN", label: "MTN", ussd: "*170#" },
  { id: "TELECEL", label: "Telecel", ussd: "*110#" },
  { id: "AT", label: "AT", ussd: "*110#" },
];

const PREFIXES: Record<MomoNetwork, string[]> = {
  MTN: ["24", "25", "53", "54", "55", "59"],
  TELECEL: ["20", "50"],
  AT: ["26", "27", "56", "57"],
};

/**
 * Network guessed from local digits (without the leading 0, as `PhoneField`
 * holds them). Only a default: a ported number keeps its old prefix.
 */
export function guessMomoNetwork(localDigits: string): MomoNetwork | null {
  const prefix = localDigits.replace(/\D/g, "").replace(/^0/, "").slice(0, 2);
  for (const id of Object.keys(PREFIXES) as MomoNetwork[]) {
    if (PREFIXES[id].includes(prefix)) return id;
  }
  return null;
}

/** "0241234521" or "241234521" → "024 ••• 4521", for showing which phone to look at. */
export function maskMomoNumber(number: string): string {
  const digits = number.replace(/\D/g, "").replace(/^233/, "").replace(/^0?/, "0");
  if (digits.length < 7) return digits;
  return `${digits.slice(0, 3)} ••• ${digits.slice(-4)}`;
}

export interface PaymentOptions {
  momo: { provider: "moolre" | "paystack"; ready: boolean };
  card: boolean;
}

/** Which flow each method uses. Until it loads, the Paystack flow is the safe assumption. */
export function usePaymentOptions() {
  return useQuery({
    queryKey: ["payments", "options"],
    queryFn: async () => (await api.get<PaymentOptions>("/payments/options")).data,
    staleTime: 5 * 60_000,
  });
}

export interface MoolreStart {
  provider: "moolre";
  reference: string;
  next: "approve" | "otp";
  payer: string;
  network: MomoNetwork;
}

/** The API's answer when a prompt from a moment ago is still on the phone. */
export function pendingPromptReference(err: unknown): string | null {
  if (!axios.isAxiosError(err) || err.response?.status !== 409) return null;
  const data = err.response.data as { code?: string; reference?: string } | undefined;
  return data?.code === "prompt_pending" && data.reference ? data.reference : null;
}

export function momoErrorCode(err: unknown): string | undefined {
  return axios.isAxiosError(err) ? (err.response?.data as { code?: string } | undefined)?.code : undefined;
}

export function useSubmitMomoCode() {
  return useMutation({
    mutationFn: async ({ reference, code }: { reference: string; code: string }) =>
      (await api.post<MoolreStart>("/payments/momo/otp", { reference, code })).data,
  });
}
