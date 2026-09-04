import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { SelfServeProfileRole } from "@wave/shared";
import { WebShell } from "../components/v6";
import { stackScreenOptions } from "../lib/navigationMotion";
import { WelcomeScreen } from "../screens/auth/WelcomeScreen";
import { PhoneEntryScreen } from "../screens/auth/PhoneEntryScreen";
import { OtpVerifyScreen } from "../screens/auth/OtpVerifyScreen";
import { RoleSelectScreen } from "../screens/auth/RoleSelectScreen";
import { ProfileSetupScreen } from "../screens/auth/ProfileSetupScreen";
import { useAuthStore } from "../store/authStore";

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneEntry: undefined;
  OtpVerify: { phone: string };
  RoleSelect: undefined;
  ProfileSetup: { role: SelfServeProfileRole };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  // A session with no profile means signup was interrupted between the OTP and
  // the profile form — the app was killed, or the phone died. Sending them back
  // to Welcome makes them request and type a second SMS code to reach a screen
  // they had already got to, so resume where they stopped instead. A signed-out
  // visitor has no token and still starts at Welcome.
  const resumingSignup = useAuthStore((s) => !!s.accessToken && !s.profile);

  return (
    <WebShell>
      <Stack.Navigator
        screenOptions={() => stackScreenOptions("auth")}
        initialRouteName={resumingSignup ? "RoleSelect" : "Welcome"}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
        <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
        <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      </Stack.Navigator>
    </WebShell>
  );
}
