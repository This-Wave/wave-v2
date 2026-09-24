import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export interface LoyaltyState {
  /** Stamps toward the next reward. Goes down as well as up. */
  stamps: number;
  threshold: number;
  discountPct: number;
  /** Lifetime deliveries — history, not the spendable number. */
  totalDeliveries: number;
  /** A full card that the next order will actually be discounted for. */
  rewardReady: boolean;
  /** A full card already priced into an unpaid order, so not spendable again. */
  rewardPending: boolean;
}

/**
 * The student's stamp card, from the server.
 *
 * Deliberately not derived from the order list. While the discount was
 * permanent, counting delivered orders and comparing with six gave the right
 * answer, and both the profile and the checkout estimate did exactly that. The
 * reward is one-shot now: the counter is spent when a discounted order is paid
 * for, which no amount of order history reveals. Deriving it locally would put
 * a card on the profile that the price at checkout then contradicted.
 *
 * `staleTime` is short because a stamp is earned the moment a delivery closes
 * and spent the moment a payment lands, and both happen while the app is open.
 */
export function useLoyalty() {
  return useQuery({
    queryKey: ["loyalty"],
    queryFn: async () => {
      const { data } = await api.get<LoyaltyState>("/loyalty");
      return data;
    },
    staleTime: 15_000,
  });
}
