import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Package, User, Wallet, Zap } from "lucide-react-native";
import { OrderFeedScreen } from "../screens/rider/OrderFeedScreen";
import { MyOrdersScreen } from "../screens/rider/MyOrdersScreen";
import { EarningsScreen } from "../screens/rider/EarningsScreen";
import { RiderProfileScreen } from "../screens/rider/RiderProfileScreen";
import { createBottomTabBar, type TabConfig } from "../components/ui/BottomTabBar";

export type RiderTabParamList = {
  Feed: undefined;
  MyOrders: undefined;
  Earnings: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RiderTabParamList>();

const TABS: TabConfig[] = [
  { name: "Feed", label: "Feed", icon: Zap },
  { name: "MyOrders", label: "My Orders", icon: Package },
  { name: "Earnings", label: "Earnings", icon: Wallet },
  { name: "Profile", label: "Profile", icon: User },
];

const TabBar = createBottomTabBar(TABS);

export function RiderTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Feed" component={OrderFeedScreen} />
      <Tab.Screen name="MyOrders" component={MyOrdersScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Profile" component={RiderProfileScreen} />
    </Tab.Navigator>
  );
}
