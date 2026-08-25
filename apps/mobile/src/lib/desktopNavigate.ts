import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../navigation/StudentNavigator";
import type { RiderStackParamList } from "../navigation/RiderNavigator";
import type { ShopStackParamList } from "../navigation/ShopNavigator";
import { useDesktopPanelStore, type DesktopPanel } from "../store/desktopPanelStore";
import { layout } from "../theme/layout";

type StudentNav = NativeStackNavigationProp<StudentStackParamList>;
type RiderNav = NativeStackNavigationProp<RiderStackParamList>;
type ShopNav = NativeStackNavigationProp<ShopStackParamList>;

export function isDesktopNow(): boolean {
  if (typeof window === "undefined") return false;
  const min = Math.max(layout.desktopLayoutAt, layout.sidebarWidth + 360);
  return window.innerWidth >= min;
}

/**
 * On desktop, open a right panel. On phone / narrow web, push a stack screen.
 */
export function openOrderTracking(navigation: StudentNav, orderId: string) {
  if (isDesktopNow()) {
    useDesktopPanelStore.getState().openPanel({ type: "orderTracking", orderId });
    return;
  }
  navigation.navigate("OrderTracking", { orderId });
}

export function openOrderDetail(navigation: StudentNav, orderId: string) {
  if (isDesktopNow()) {
    useDesktopPanelStore.getState().openPanel({ type: "orderDetail", orderId });
    return;
  }
  navigation.navigate("OrderDetail", { orderId });
}

export function openWaveCalendar(navigation: StudentNav) {
  if (isDesktopNow()) {
    useDesktopPanelStore.getState().openPanel({ type: "waveCalendar" });
    return;
  }
  navigation.navigate("WaveCalendar");
}

export function openPaymentMethods(navigation: StudentNav) {
  if (isDesktopNow()) {
    useDesktopPanelStore.getState().openPanel({ type: "paymentMethods" });
    return;
  }
  navigation.navigate("PaymentMethods");
}

export function openShopMenu(
  navigation: StudentNav,
  params: {
    shopId: string;
    shopName: string;
    scheduledDate: string;
    isSpecialOrder: boolean;
  },
) {
  if (isDesktopNow()) {
    useDesktopPanelStore.getState().openPanel({ type: "shopMenu", ...params });
    return;
  }
  navigation.navigate("ShopMenu", params);
}

export function openRiderClaim(navigation: RiderNav, orderId: string) {
  if (isDesktopNow()) {
    useDesktopPanelStore.getState().openPanel({ type: "riderClaim", orderId });
    return;
  }
  navigation.navigate("OrderDetail", { orderId });
}

export function openShopIncoming(navigation: ShopNav, orderId: string) {
  if (isDesktopNow()) {
    useDesktopPanelStore.getState().openPanel({ type: "shopIncoming", orderId });
    return;
  }
  navigation.navigate("IncomingOrderDetail", { orderId });
}

export function openDesktopPanel(panel: NonNullable<DesktopPanel>) {
  useDesktopPanelStore.getState().openPanel(panel);
}
