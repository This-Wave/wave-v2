import { useMemo } from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/student/HomeScreen";
import { OrderHistoryScreen } from "../screens/student/OrderHistoryScreen";
import { ProfileScreen } from "../screens/student/ProfileScreen";
import { TabBar, LiveOrderBar } from "../components/v6";
import { useLayout } from "../hooks/useLayout";
import { useMyOrders } from "../lib/orders";

export type StudentTabParamList = {
  Home: undefined;
  Orders: undefined;
  Checkpoints: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<StudentTabParamList>();

const LIVE = ["confirmed", "rider_assigned", "en_route", "at_checkpoint"];

export function StudentTabNavigator() {
  const { isDesktop } = useLayout();
  const { data: orders } = useMyOrders();

  const ordersBadge = useMemo(() => {
    const list = orders ?? [];
    const live = list.filter((o) => LIVE.includes(o.status)).length;
    const unpaid = list.filter((o) => o.status === "payment_pending").length;
    const total = live + unpaid;
    return total > 0 ? total : undefined;
  }, [orders]);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: "Home" }} />
        <Tab.Screen
          name="Orders"
          component={OrderHistoryScreen}
          options={{ tabBarLabel: "Orders", tabBarBadge: ordersBadge }}
        />
        <Tab.Screen
          name="Checkpoints"
          component={CheckpointsTab}
          options={{ tabBarLabel: "Checkpoints" }}
        />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: "Profile" }} />
      </Tab.Navigator>
      {!isDesktop ? <LiveOrderBar /> : null}
    </View>
  );
}

import { CheckpointsScreen } from "../screens/student/CheckpointsScreen";
function CheckpointsTab() {
  return <CheckpointsScreen />;
}
