import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { AppWebShell } from "../components/v6";
import { stackScreenOptions, tabsStackScreenOptions } from "../lib/navigationMotion";
import { StudentTabNavigator, type StudentTabParamList } from "./StudentTabNavigator";
import { WaveCalendarScreen } from "../screens/student/WaveCalendarScreen";
import { ChooseServiceScreen } from "../screens/student/ChooseServiceScreen";
import { ShopSelectionScreen } from "../screens/student/ShopSelectionScreen";
import { ShopMenuScreen } from "../screens/student/ShopMenuScreen";
import { SuggestShopScreen } from "../screens/student/SuggestShopScreen";
import { SuggestOrderSummaryScreen } from "../screens/student/SuggestOrderSummaryScreen";
import { DescribeOrderScreen } from "../screens/student/DescribeOrderScreen";
import { OrderSummaryScreen } from "../screens/student/OrderSummaryScreen";
import { PaymentScreen } from "../screens/student/PaymentScreen";
import { PaymentMethodsScreen } from "../screens/student/PaymentMethodsScreen";
import { CheckpointsScreen } from "../screens/student/CheckpointsScreen";
import { OrderConfirmedScreen } from "../screens/student/OrderConfirmedScreen";
import { PickupRequestScreen } from "../screens/student/PickupRequestScreen";
import { OrderTrackingScreen } from "../screens/student/OrderTrackingScreen";
import { OrderDetailScreen } from "../screens/student/OrderDetailScreen";
import { PickupPinScreen } from "../screens/student/PickupPinScreen";
import { CutoffPassedScreen } from "../screens/student/CutoffPassedScreen";
import { PaymentFailedScreen } from "../screens/student/PaymentFailedScreen";
import { PaymentReturnScreen } from "../screens/student/PaymentReturnScreen";

/**
 * A chosen basket line, as it travels between screens.
 *
 * `itemsPreview` carries names and prices purely so the summary can render a
 * priced list without re-fetching the menu. The server is still handed only
 * `items` — `{ productId, quantity }` — and prices everything itself.
 */
export interface BasketLine {
  productId: string;
  quantity: number;
}

export interface BasketPreviewLine {
  name: string;
  unitPrice: number;
  quantity: number;
}

/** The Wave a flow is being booked onto. Threaded from the calendar onward. */
interface WaveParams {
  scheduledDate: string;
  isSpecialOrder: boolean;
}

export type StudentStackParamList = {
  Tabs: NavigatorScreenParams<StudentTabParamList> | undefined;
  WaveCalendar: undefined;
  ChooseService: WaveParams;
  // Undefined when entered from Home's "Buy for me" tile, which books the next
  // open Wave — the calendar is the deliberate path, not the only one.
  ShopSelection: WaveParams | undefined;
  ShopMenu: { shopId: string; shopName: string } & WaveParams;
  SuggestShop: { initialQuery?: string } & WaveParams;
  SuggestOrderSummary: {
    suggestionId: string;
    shopName: string;
    locationText?: string;
    manualItems: { name: string; quantity: number }[];
  } & WaveParams;
  DescribeOrder: {
    shopId: string;
    shopName: string;
    items: BasketLine[];
    itemsPreview: BasketPreviewLine[];
    notes?: string;
  } & WaveParams;
  OrderSummary: {
    shopId: string;
    shopName: string;
    items: BasketLine[];
    itemsPreview: BasketPreviewLine[];
    checkpointId: string;
    checkpointName: string;
    notes?: string;
  } & WaveParams;
  Payment: { orderId: string; totalAmount: number };
  /** Same-tab Paystack return — confirms then replaces with success/failure. */
  PaymentReturn: { orderId: string; reference: string; totalAmount: number };
  PaymentMethods: undefined;
  Checkpoints: undefined;
  OrderConfirmed: { orderId: string };
  PickupRequest: WaveParams | undefined;
  OrderTracking: { orderId: string };
  OrderDetail: { orderId: string };
  PickupPin: { orderId: string };
  CutoffPassed: undefined;
  PaymentFailed: { orderId: string; totalAmount: number };
};

const Stack = createNativeStackNavigator<StudentStackParamList>();

export function StudentNavigator() {
  return (
    <AppWebShell role="student">
      <Stack.Navigator screenOptions={() => stackScreenOptions("checkout")}>
        <Stack.Screen name="Tabs" component={StudentTabNavigator} options={tabsStackScreenOptions} />
        <Stack.Screen name="WaveCalendar" component={WaveCalendarScreen} />
        <Stack.Screen name="ChooseService" component={ChooseServiceScreen} />
        <Stack.Screen name="ShopSelection" component={ShopSelectionScreen} />
        <Stack.Screen name="ShopMenu" component={ShopMenuScreen} />
        <Stack.Screen name="SuggestShop" component={SuggestShopScreen} />
        <Stack.Screen name="SuggestOrderSummary" component={SuggestOrderSummaryScreen} />
        <Stack.Screen name="DescribeOrder" component={DescribeOrderScreen} />
        <Stack.Screen name="OrderSummary" component={OrderSummaryScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="PaymentReturn" component={PaymentReturnScreen} />
        <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
        <Stack.Screen name="Checkpoints" component={CheckpointsScreen} />
        <Stack.Screen name="OrderConfirmed" component={OrderConfirmedScreen} />
        <Stack.Screen name="PickupRequest" component={PickupRequestScreen} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="PickupPin" component={PickupPinScreen} />
        <Stack.Screen name="CutoffPassed" component={CutoffPassedScreen} />
        <Stack.Screen name="PaymentFailed" component={PaymentFailedScreen} />
      </Stack.Navigator>
    </AppWebShell>
  );
}
