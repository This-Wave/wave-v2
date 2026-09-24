import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Shop } from "../types";

/**
 * The shops a student can order from.
 *
 * `enabled` is how Home avoids asking before Buy for me launches: the API
 * answers 503 while the catalogue is closed, and a screen that never draws
 * shops should not be making a failing request on every visit.
 */
export function useShops({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    enabled,
    queryKey: ["shops"],
    queryFn: async () => {
      const { data } = await api.get<{ shops: Shop[] }>("/shops");
      return data.shops;
    },
  });
}
