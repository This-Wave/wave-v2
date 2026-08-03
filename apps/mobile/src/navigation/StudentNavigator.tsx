import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { StudentTabNavigator, type StudentTabParamList } from "./StudentTabNavigator";
import { ShopSelectionScreen } from "../screens/student/ShopSelectionScreen";
import { DescribeOrderScreen } from "../screens/student/DescribeOrderScreen";
import { OrderSummaryScreen } from "../screens/student/OrderSummaryScreen";
import { PaymentScreen } from "../screens/student/PaymentScreen";
import { PaymentMethodsScreen } from "../screens/student/PaymentMethodsScreen";
import { CheckpointsScreen } from "../screens/student/CheckpointsScreen";
import { OrderConfirmedScreen } from "../screens/student/OrderConfirmedScreen";
import { PickupRequestScreen } from "../screens/student/PickupRequestScreen";
import { OrderTrackingScreen } from "../screens/student/OrderTrackingScreen";
import { OrderTimelineScreen } from "../screens/student/OrderTimelineScreen";
import { OrderDetailScreen } from "../screens/student/OrderDetailScreen";
import { PickupPinScreen } from "../screens/student/PickupPinScreen";
import { CutoffPassedScreen } from "../screens/student/CutoffPassedScreen";
import { PaymentFailedScreen } from "../screens/student/PaymentFailedScreen";

export type StudentStackParamList = {
  Tabs: NavigatorScreenParams<StudentTabParamList> | undefined;
  ShopSelection: undefined;
  DescribeOrder: { shopId: string; shopName: string; isSpecialOrder?: boolean };
  OrderSummary: {
    shopId: string;
    shopName: string;
    itemDescription: string;
    scheduledDate: string;
    isSpecialOrder: boolean;
    checkpointId: string;
    checkpointName: string;
    budget?: string;
    notes?: string;
  };
  Payment: { orderId: string; totalAmount: number };
  PaymentMethods: undefined;
  Checkpoints: undefined;
  OrderConfirmed: { orderId: string };
  PickupRequest: undefined;
  OrderTracking: { orderId: string };
  OrderTimeline: { orderId: string };
  OrderDetail: { orderId: string };
  PickupPin: { orderId: string };
  CutoffPassed: undefined;
  PaymentFailed: { orderId: string; totalAmount: number };
};

const Stack = createNativeStackNavigator<StudentStackParamList>();

export function StudentNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={StudentTabNavigator} />
      <Stack.Screen name="ShopSelection" component={ShopSelectionScreen} />
      <Stack.Screen name="DescribeOrder" component={DescribeOrderScreen} />
      <Stack.Screen name="OrderSummary" component={OrderSummaryScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <Stack.Screen name="Checkpoints" component={CheckpointsScreen} />
      <Stack.Screen name="OrderConfirmed" component={OrderConfirmedScreen} />
      <Stack.Screen name="PickupRequest" component={PickupRequestScreen} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="OrderTimeline" component={OrderTimelineScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="PickupPin" component={PickupPinScreen} />
      <Stack.Screen name="CutoffPassed" component={CutoffPassedScreen} />
      <Stack.Screen name="PaymentFailed" component={PaymentFailedScreen} />
    </Stack.Navigator>
  );
}
