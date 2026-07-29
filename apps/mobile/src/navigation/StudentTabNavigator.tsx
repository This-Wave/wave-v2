import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/student/HomeScreen";
import { OrderHistoryScreen } from "../screens/student/OrderHistoryScreen";
import { ShopSelectionScreen } from "../screens/student/ShopSelectionScreen";
import { ProfileScreen } from "../screens/student/ProfileScreen";
import { createBottomTabBar, type TabConfig } from "../components/ui/BottomTabBar";
import { BoxIcon, HomeIcon, PinIcon, UserIcon } from "../components/icons";

export type StudentTabParamList = {
  Home: undefined;
  Orders: undefined;
  Shops: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<StudentTabParamList>();

// v5 tab order and glyphs: home, package, pin, person.
const TABS: TabConfig[] = [
  { name: "Home", label: "Home", icon: HomeIcon },
  { name: "Orders", label: "Orders", icon: BoxIcon },
  { name: "Shops", label: "Shops", icon: PinIcon },
  { name: "Profile", label: "Profile", icon: UserIcon },
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
