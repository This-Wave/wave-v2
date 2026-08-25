import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Product } from "../types";

/**
 * A shop's catalogue.
 *
 * Students only ever see `active` products — an out-of-stock item in the picker
 * is a basket that fails at checkout, which is a worse experience than never
 * offering it. The shop owner's own menu screen deliberately fetches everything,
 * because they need to see and un-hide what they've paused.
 */
export function useShopProducts(shopId: string | undefined, options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ["products", shopId, options?.includeInactive ?? false],
    queryFn: async () => {
      const { data } = await api.get<{ products: Product[] }>(`/shops/${shopId}/products`);
      return options?.includeInactive
        ? data.products
        : data.products.filter((p) => p.status === "active");
    },
    enabled: !!shopId,
  });
}
