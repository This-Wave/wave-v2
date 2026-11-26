import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The campus pickup point a student set as their default (v7 "Pickup
 * points"). Kept on the device: it only pre-selects the point in Send, and
 * every order still says where it is going.
 */
interface PickupPointState {
  defaultId: string | null;
  setDefault: (id: string) => void;
}

export const usePickupPointStore = create<PickupPointState>()(
  persist(
    (set) => ({
      defaultId: null,
      setDefault: (id) => set({ defaultId: id }),
    }),
    { name: "wave.pickupPoint", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
