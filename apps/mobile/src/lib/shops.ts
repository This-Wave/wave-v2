import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Shop } from "../types";

export function useShops() {
  return useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const { data } = await api.get<{ shops: Shop[] }>("/shops");
      return data.shops;
    },
  });
}
