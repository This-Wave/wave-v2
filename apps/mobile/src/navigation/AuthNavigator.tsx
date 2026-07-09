import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WelcomeScreen } from "../screens/auth/WelcomeScreen";
import { PhoneEntryScreen } from "../screens/auth/PhoneEntryScreen";
import { OtpVerifyScreen } from "../screens/auth/OtpVerifyScreen";
import { ProfileSetupScreen } from "../screens/auth/ProfileSetupScreen";

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneEntry: undefined;
  OtpVerify: { phone: string };
  ProfileSetup: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}
