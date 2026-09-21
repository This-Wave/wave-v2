import { useQuery } from "@tanstack/react-query";
import type { ServiceStatus } from "@wave/shared";
import { api } from "./api";
import { useAuthStore } from "../store/authStore";

/**
 * Whether Wave is taking new orders at this student's campus.
 *
 * A pause is set by staff in the admin and enforced by the API regardless; this
 * only exists so the app can say so up front, in the admin's own words, instead
 * of letting someone build a basket and be refused at the last step.
 *
 * Unlike feature flags, a failed fetch reads as "running". Refusing orders
 * because a status check timed out would be the app inventing an outage.
 */
export function useServiceStatus() {
  const universityId = useAuthStore((s) => s.profile?.universityId ?? null);
  return useQuery({
    queryKey: ["service-status", universityId],
    queryFn: async () => {
      const { data } = await api.get<{ status: ServiceStatus }>("/service-status", {
        params: universityId ? { universityId } : undefined,
      });
      return data.status;
    },
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}
