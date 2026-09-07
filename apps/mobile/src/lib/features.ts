import { useQuery } from "@tanstack/react-query";
import { allFeaturesOff, type FeatureKey } from "@wave/shared";
import { api } from "./api";

/**
 * Feature flags for the signed-in student, rider or shop owner.
 *
 * Resolved server-side for their university, so the app never sees the rows and
 * cannot be confused by a flag that is on somewhere else.
 *
 * Cached for five minutes rather than fetched per screen: a flag flipped in the
 * admin should reach people in minutes, not on next launch, and not on every
 * render either.
 */
export function useFeatures() {
  return useQuery({
    queryKey: ["features"],
    queryFn: async () => {
      const { data } = await api.get<{ features: Record<FeatureKey, boolean> }>("/features");
      return data.features;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Whether one feature is on. Off while loading and off if the fetch failed.
 *
 * That is the deliberate choice: a student on a bad connection sees the app
 * they had yesterday rather than a half-drawn feature whose server calls will
 * be rejected anyway. It also means the flag never *flickers* on — which is
 * what a `true` default would do on every cold start.
 */
export function useFeature(key: FeatureKey): boolean {
  const { data } = useFeatures();
  return (data ?? allFeaturesOff())[key];
}
