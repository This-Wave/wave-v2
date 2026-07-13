import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { ShopTabNavigator, type ShopTabParamList } from "./ShopTabNavigator";
import { IncomingOrderDetailScreen } from "../screens/shop/IncomingOrderDetailScreen";

export type ShopStackParamList = {
  Tabs: NavigatorScreenParams<ShopTabParamList> | undefined;
  IncomingOrderDetail: { orderId: string };
};

const Stack = createNativeStackNavigator<ShopStackParamList>();

export function ShopNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={ShopTabNavigator} />
      <Stack.Screen name="IncomingOrderDetail" component={IncomingOrderDetailScreen} />
    </Stack.Navigator>
  );
}
