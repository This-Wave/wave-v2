import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BoxIcon, DashboardIcon, MenuIcon, SettingsIcon } from "../components/icons";
import { ShopDashboardScreen } from "../screens/shop/ShopDashboardScreen";
import { ShopOrdersScreen } from "../screens/shop/ShopOrdersScreen";
import { MenuScreen } from "../screens/shop/MenuScreen";
import { ShopSettingsScreen } from "../screens/shop/ShopSettingsScreen";
import { createBottomTabBar, type TabConfig } from "../components/ui/BottomTabBar";

export type ShopTabParamList = {
  Dashboard: undefined;
  Orders: undefined;
  Menu: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<ShopTabParamList>();

const TABS: TabConfig[] = [
  { name: "Dashboard", label: "Dashboard", icon: DashboardIcon },
  { name: "Orders", label: "Orders", icon: BoxIcon },
  { name: "Menu", label: "Menu", icon: MenuIcon },
  { name: "Settings", label: "Settings", icon: SettingsIcon },
];

const TabBar = createBottomTabBar(TABS);

export function ShopTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Dashboard" component={ShopDashboardScreen} />
      <Tab.Screen name="Orders" component={ShopOrdersScreen} />
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Settings" component={ShopSettingsScreen} />
    </Tab.Navigator>
  );
}
