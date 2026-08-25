import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { AppWebShell } from "../components/v6";
import { stackScreenOptions, tabsStackScreenOptions } from "../lib/navigationMotion";
import { RiderTabNavigator, type RiderTabParamList } from "./RiderTabNavigator";
import { OrderDetailScreen } from "../screens/rider/OrderDetailScreen";
import { ActiveDeliveryScreen } from "../screens/rider/ActiveDeliveryScreen";
import { PinEntryScreen } from "../screens/rider/PinEntryScreen";
import { RecordGoodsCostScreen } from "../screens/rider/RecordGoodsCostScreen";
import { SubmitVerificationScreen } from "../screens/rider/SubmitVerificationScreen";

export type RiderStackParamList = {
  Tabs: NavigatorScreenParams<RiderTabParamList> | undefined;
  OrderDetail: { orderId: string };
  ActiveDelivery: { orderId: string };
  PinEntry: { orderId: string };
  RecordGoodsCost: { orderId: string };
  SubmitVerification: undefined;
};

const Stack = createNativeStackNavigator<RiderStackParamList>();

export function RiderNavigator() {
  return (
    <AppWebShell role="rider">
      <Stack.Navigator screenOptions={() => stackScreenOptions("app")}>
        <Stack.Screen name="Tabs" component={RiderTabNavigator} options={tabsStackScreenOptions} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="ActiveDelivery" component={ActiveDeliveryScreen} />
        <Stack.Screen name="PinEntry" component={PinEntryScreen} />
        <Stack.Screen name="RecordGoodsCost" component={RecordGoodsCostScreen} />
        <Stack.Screen name="SubmitVerification" component={SubmitVerificationScreen} />
      </Stack.Navigator>
    </AppWebShell>
  );
}
