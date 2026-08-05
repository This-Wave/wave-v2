import { create } from "zustand";

interface ShopState {
  /**
   * Which of the owner's shops the shop-side screens are currently acting on.
   *
   * Null means "not chosen yet" — `useSelectedShop` then falls back to the first
   * shop returned by the API, which is ordered by name so that default is stable
   * between requests rather than whichever row Postgres happened to return.
   */
  selectedShopId: string | null;
  setSelectedShopId: (id: string | null) => void;
}

export const useShopStore = create<ShopState>((set) => ({
  selectedShopId: null,
  setSelectedShopId: (selectedShopId) => set({ selectedShopId }),
}));
