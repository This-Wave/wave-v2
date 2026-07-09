import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Package, Store, User } from "lucide-react-native";
import { HomeScreen } from "../screens/student/HomeScreen";
import { OrderHistoryScreen } from "../screens/student/OrderHistoryScreen";
import { ShopSelectionScreen } from "../screens/student/ShopSelectionScreen";
import { ProfileScreen } from "../screens/student/ProfileScreen";
import { createBottomTabBar, type TabConfig } from "../components/ui/BottomTabBar";

export type StudentTabParamList = {
  Home: undefined;
  Orders: undefined;
  Shops: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<StudentTabParamList>();

const TABS: TabConfig[] = [
  { name: "Home", label: "Home", icon: Home },
  { name: "Orders", label: "Orders", icon: Package },
  { name: "Shops", label: "Shops", icon: Store },
  { name: "Profile", label: "Profile", icon: User },
];

const TabBar = createBottomTabBar(TABS);

export function StudentTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} />
      <Tab.Screen name="Shops" component={ShopSelectionScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
