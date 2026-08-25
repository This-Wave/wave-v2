import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { AppWebShell } from "../components/v6";
import { stackScreenOptions, tabsStackScreenOptions } from "../lib/navigationMotion";
import { ShopTabNavigator, type ShopTabParamList } from "./ShopTabNavigator";
import { IncomingOrderDetailScreen } from "../screens/shop/IncomingOrderDetailScreen";

export type ShopStackParamList = {
  Tabs: NavigatorScreenParams<ShopTabParamList> | undefined;
  IncomingOrderDetail: { orderId: string };
};

const Stack = createNativeStackNavigator<ShopStackParamList>();

export function ShopNavigator() {
  return (
    <AppWebShell role="shop">
      <Stack.Navigator screenOptions={() => stackScreenOptions("app")}>
        <Stack.Screen name="Tabs" component={ShopTabNavigator} options={tabsStackScreenOptions} />
        <Stack.Screen name="IncomingOrderDetail" component={IncomingOrderDetailScreen} />
      </Stack.Navigator>
    </AppWebShell>
  );
}
