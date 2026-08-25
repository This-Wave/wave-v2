import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateShopSuggestionInput } from "@wave/shared";
import { api } from "./api";
import type { ShopSuggestion } from "../types";

export function useMySuggestions() {
  return useQuery({
    queryKey: ["suggestions", "mine"],
    queryFn: async () => {
      const { data } = await api.get<{ suggestions: ShopSuggestion[] }>("/shop-suggestions/mine");
      return data.suggestions;
    },
  });
}

/**
 * Suggests a shop and returns the suggestion to attach an order to.
 *
 * The server is idempotent per student per pending place, so re-submitting the
 * same shop returns the existing row rather than inflating the demand ranking.
 * That means the screen can safely retry.
 */
export function useSuggestShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateShopSuggestionInput) => {
      const { data } = await api.post<{ suggestion: ShopSuggestion }>("/shop-suggestions", input);
      return data.suggestion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
    },
  });
}
