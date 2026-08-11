import { create } from "zustand";

export type DesktopPanel =
  | { type: "orderTracking"; orderId: string }
  | { type: "orderDetail"; orderId: string }
  | { type: "waveCalendar" }
  | { type: "paymentMethods" }
  | {
      type: "shopMenu";
      shopId: string;
      shopName: string;
      scheduledDate: string;
      isSpecialOrder: boolean;
    }
  | { type: "riderClaim"; orderId: string }
  | { type: "shopIncoming"; orderId: string }
  | null;

interface DesktopPanelState {
  panel: DesktopPanel;
  openPanel: (panel: NonNullable<DesktopPanel>) => void;
  closePanel: () => void;
}

/** Desktop-only right rail. Mobile never reads this. */
export const useDesktopPanelStore = create<DesktopPanelState>((set) => ({
  panel: null,
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: null }),
}));
