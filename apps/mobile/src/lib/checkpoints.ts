import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Checkpoint, University } from "../types";

export function useUniversities() {
  return useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data } = await api.get<{ universities: University[] }>("/universities");
      return data.universities;
    },
  });
}

/**
 * Every checkpoint on the campus: campus drop-offs and the Accra zone pickup
 * points. Only a pickup's "Collect from" wants both; everything that picks a
 * destination wants `useDropoffPoints`.
 */
export function useCheckpoints(universityId: string | undefined) {
  return useQuery({
    queryKey: ["checkpoints", universityId],
    queryFn: async () => {
      const { data } = await api.get<{ checkpoints: Checkpoint[] }>(`/universities/${universityId}/checkpoints`);
      return data.checkpoints;
    },
    enabled: !!universityId,
  });
}

/** Campus checkpoints only — the places a delivery can end. */
export function useDropoffPoints(universityId: string | undefined) {
  const query = useCheckpoints(universityId);
  return { ...query, data: query.data?.filter((c) => !c.zone) };
}

/**
 * The delivery fee a pickup from `origin` will be charged: its zone's fee, or
 * the base fee for a campus checkpoint. Display only — the API decides.
 */
export function pickupFeeFor(origin: Checkpoint | undefined, baseFee: number): number {
  return origin?.zone ? Number(origin.zone.deliveryFee) : baseFee;
}
