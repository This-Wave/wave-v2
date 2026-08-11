import { useMemo } from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { OrderFeedScreen } from "../screens/rider/OrderFeedScreen";
import { MyOrdersScreen } from "../screens/rider/MyOrdersScreen";
import { EarningsScreen } from "../screens/rider/EarningsScreen";
import { RiderProfileScreen } from "../screens/rider/RiderProfileScreen";
import { TabBar, ActiveDeliveryBar } from "../components/v6";
import { useLayout } from "../hooks/useLayout";
import { useMyDeliveries } from "../lib/rider";

export type RiderTabParamList = {
  Feed: undefined;
  MyOrders: undefined;
  Earnings: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RiderTabParamList>();

const ACTIVE = ["rider_assigned", "en_route", "at_checkpoint"];

export function RiderTabNavigator() {
  const { isDesktop } = useLayout();
  const { data: orders } = useMyDeliveries();

  const deliveriesBadge = useMemo(() => {
    const count = (orders ?? []).filter((o) => ACTIVE.includes(o.status)).length;
    return count > 0 ? count : undefined;
  }, [orders]);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tab.Screen name="Feed" component={OrderFeedScreen} options={{ tabBarLabel: "Feed" }} />
        <Tab.Screen
          name="MyOrders"
          component={MyOrdersScreen}
          options={{ tabBarLabel: "Deliveries", tabBarBadge: deliveriesBadge }}
        />
        <Tab.Screen name="Earnings" component={EarningsScreen} options={{ tabBarLabel: "Earnings" }} />
        <Tab.Screen name="Profile" component={RiderProfileScreen} options={{ tabBarLabel: "Profile" }} />
      </Tab.Navigator>
      {!isDesktop ? <ActiveDeliveryBar /> : null}
    </View>
  );
}
