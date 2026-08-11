import { CommonActions } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../navigation/StudentNavigator";
import type { RiderStackParamList } from "../navigation/RiderNavigator";
import type { StudentTabParamList } from "../navigation/StudentTabNavigator";
import type { RiderTabParamList } from "../navigation/RiderTabNavigator";

type StudentNav = NativeStackNavigationProp<StudentStackParamList>;
type RiderNav = NativeStackNavigationProp<RiderStackParamList>;

type StudentTab = keyof StudentTabParamList;
type RiderTab = keyof RiderTabParamList;

/** Clear checkout stack and land on a tab. */
export function resetStudentTabs(navigation: StudentNav, tab: StudentTab = "Home") {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Tabs", params: { screen: tab } }],
    }),
  );
}

/** After payment succeeds or fails — no checkout screens left in history. */
export function resetAfterPaymentOutcome(
  navigation: StudentNav,
  screen:
    | { name: "OrderConfirmed"; params: { orderId: string } }
    | { name: "PaymentFailed"; params: { orderId: string; totalAmount: number } },
) {
  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [{ name: "Tabs", params: { screen: "Home" } }, screen],
    }),
  );
}

export function resetAfterOrderConfirmed(
  navigation: StudentNav,
  orderId: string,
  target: "home" | "tracking",
) {
  if (target === "tracking") {
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: "Tabs", params: { screen: "Home" } },
          { name: "OrderTracking", params: { orderId } },
        ],
      }),
    );
    return;
  }
  resetStudentTabs(navigation, "Home");
}

/** Pay an existing order without leaving checkout history under the payment screen. */
export function resetToPayment(
  navigation: StudentNav,
  params: StudentStackParamList["Payment"],
) {
  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [{ name: "Tabs", params: { screen: "Orders" } }, { name: "Payment", params }],
    }),
  );
}

/** Reorder — fresh menu stack, not piled on an old checkout chain. */
export function resetToShopMenu(
  navigation: StudentNav,
  params: StudentStackParamList["ShopMenu"],
) {
  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [{ name: "Tabs", params: { screen: "Home" } }, { name: "ShopMenu", params }],
    }),
  );
}

/** Order exists but payment deferred — leave checkout, keep order on Orders tab. */
export function exitPaymentToOrders(navigation: StudentNav) {
  resetStudentTabs(navigation, "Orders");
}

export function resetRiderTabs(navigation: RiderNav, tab: RiderTab = "MyOrders") {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Tabs", params: { screen: tab } }],
    }),
  );
}
