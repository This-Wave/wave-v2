import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { OrderFeedScreen } from "../screens/rider/OrderFeedScreen";
import { MyOrdersScreen } from "../screens/rider/MyOrdersScreen";
import { EarningsScreen } from "../screens/rider/EarningsScreen";
import { RiderProfileScreen } from "../screens/rider/RiderProfileScreen";
import { TabBar } from "../components/v6";

export type RiderTabParamList = {
  Feed: undefined;
  MyOrders: undefined;
  Earnings: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RiderTabParamList>();


export function RiderTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Feed" component={OrderFeedScreen} options={{ tabBarLabel: "Feed" }} />
      <Tab.Screen name="MyOrders" component={MyOrdersScreen} options={{ tabBarLabel: "Deliveries" }} />
      <Tab.Screen name="Earnings" component={EarningsScreen} options={{ tabBarLabel: "Earnings" }} />
      <Tab.Screen name="Profile" component={RiderProfileScreen} options={{ tabBarLabel: "Profile" }} />
    </Tab.Navigator>
  );
}
