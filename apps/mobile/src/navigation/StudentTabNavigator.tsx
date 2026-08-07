import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/student/HomeScreen";
import { OrderHistoryScreen } from "../screens/student/OrderHistoryScreen";
import { ProfileScreen } from "../screens/student/ProfileScreen";
import { TabBar } from "../components/v6";

export type StudentTabParamList = {
  Home: undefined;
  Orders: undefined;
  Checkpoints: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<StudentTabParamList>();

/**
 * v6 tabs. "Shops" is gone from the bar: browsing shops is what Home *is* now,
 * so the tab pointed at a duplicate of the screen the student was already on.
 * Checkpoints takes the slot — it answers "where do I go", which nothing else
 * in the bar did.
 */
export function StudentTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: "Home" }} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} options={{ tabBarLabel: "Orders" }} />
      <Tab.Screen
        name="Checkpoints"
        component={CheckpointsTab}
        options={{ tabBarLabel: "Checkpoints" }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: "Profile" }} />
    </Tab.Navigator>
  );
}

// Re-exported so the tab and the stack route can share one screen component.
import { CheckpointsScreen } from "../screens/student/CheckpointsScreen";
function CheckpointsTab() {
  return <CheckpointsScreen />;
}
