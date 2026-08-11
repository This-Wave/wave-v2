import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ShopDashboardScreen } from "../screens/shop/ShopDashboardScreen";
import { ShopOrdersScreen } from "../screens/shop/ShopOrdersScreen";
import { MenuScreen } from "../screens/shop/MenuScreen";
import { ShopSettingsScreen } from "../screens/shop/ShopSettingsScreen";
import { TabBar } from "../components/v6";

export type ShopTabParamList = {
  Dashboard: undefined;
  ShopOrders: undefined;
  Menu: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<ShopTabParamList>();


export function ShopTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Dashboard" component={ShopDashboardScreen} options={{ tabBarLabel: "Today" }} />
      <Tab.Screen name="ShopOrders" component={ShopOrdersScreen} options={{ tabBarLabel: "Orders" }} />
      <Tab.Screen name="Menu" component={MenuScreen} options={{ tabBarLabel: "Menu" }} />
      <Tab.Screen name="Settings" component={ShopSettingsScreen} options={{ tabBarLabel: "Settings" }} />
    </Tab.Navigator>
  );
}
