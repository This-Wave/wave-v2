import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WelcomeScreen } from "../screens/WelcomeScreen";

// Role-specific navigators (StudentNavigator, RiderNavigator, ShopNavigator)
// get added here once auth + profile screens land — see handoff.md.
export type RootStackParamList = {
  Welcome: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
    </Stack.Navigator>
  );
}
