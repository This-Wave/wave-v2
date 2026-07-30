import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useAuthStore } from "../store/authStore";

/** Must match `riderFeedTopic` / `NEW_ORDER_EVENT` in the API. */
const NEW_ORDER_EVENT = "orders:changed";
const riderFeedTopic = (universityId: string) => `riders:${universityId}`;

/**
 * Refreshes the available-order feed the moment a new order is paid for.
 *
 * The API publishes to this channel over Supabase Realtime's HTTP broadcast
 * API. It is a **broadcast** channel, not a table subscription — Realtime
 * watches Supabase's own Postgres and Wave's orders live in Neon (ADR-002), so
 * there is no table here to subscribe to.
 *
 * The message carries no order detail on purpose: anyone holding the anon key
 * can join a broadcast topic, so it only says "the feed changed" and this hook
 * refetches `/orders/available` under the rider's own authenticated session.
 *
 * `useAvailableOrders` still polls, which is what covers a dropped socket or a
 * failed publish — this just collapses the usual wait to nothing.
 */
export function useRiderFeedBroadcast(): void {
  const queryClient = useQueryClient();
  const universityId = useAuthStore((s) => s.profile?.universityId);

  useEffect(() => {
    if (!universityId) return;

    const channel = supabase
      .channel(riderFeedTopic(universityId))
      .on("broadcast", { event: NEW_ORDER_EVENT }, () => {
        queryClient.invalidateQueries({ queryKey: ["orders", "available"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [universityId, queryClient]);
}
