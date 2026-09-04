import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { AppWebShell } from "../components/v6";
import { stackScreenOptions, tabsStackScreenOptions } from "../lib/navigationMotion";
import { RiderTabNavigator, type RiderTabParamList } from "./RiderTabNavigator";
import { OrderDetailScreen } from "../screens/rider/OrderDetailScreen";
import { ActiveDeliveryScreen } from "../screens/rider/ActiveDeliveryScreen";
import { PinEntryScreen } from "../screens/rider/PinEntryScreen";
import { RecordGoodsCostScreen } from "../screens/rider/RecordGoodsCostScreen";
import { SubmitVerificationScreen } from "../screens/rider/SubmitVerificationScreen";
import { VerificationPendingScreen } from "../screens/rider/VerificationPendingScreen";
import { FirstRunTour } from "../components/FirstRunTour";
import { useAuthStore } from "../store/authStore";
import { initialRiderOnboardingRoute, useVerificationStatus } from "../lib/rider";

export type RiderStackParamList = {
  Tabs: NavigatorScreenParams<RiderTabParamList> | undefined;
  OrderDetail: { orderId: string };
  ActiveDelivery: { orderId: string };
  PinEntry: { orderId: string };
  RecordGoodsCost: { orderId: string };
  SubmitVerification: undefined;
};

/** The only two screens an unverified rider can reach. */
export type RiderOnboardingStackParamList = {
  SubmitVerification: undefined;
  VerificationPending: undefined;
};

const Stack = createNativeStackNavigator<RiderStackParamList>();
const OnboardingStack = createNativeStackNavigator<RiderOnboardingStackParamList>();

/**
 * Verification gate.
 *
 * `orders/routes.ts` has always refused an unverified rider's accept, but
 * nothing in the app read `isVerified`, so a new rider saw the real order feed
 * — other students' names, orders and checkpoints — and got an unexplained
 * error on every attempt to work. The gate is the app-side half of a rule the
 * server already enforced.
 *
 * Which screen they land on depends on whether documents are already in. A
 * `pending` or `approved` row means wait (an `approved` row with an unverified
 * profile is a stale profile, and "Check status" fixes it); a `rejected` row
 * means show the reason. No row at all means they never finished submitting.
 */
function RiderOnboardingNavigator() {
  const { data: verification, isLoading } = useVerificationStatus();

  // Wait for the row before choosing, or a rider with documents already in
  // briefly sees the submit form again and may send a duplicate.
  const initialRoute = initialRiderOnboardingRoute(verification, isLoading);

  return (
    <AppWebShell role="rider">
      <OnboardingStack.Navigator
        screenOptions={() => stackScreenOptions("auth")}
        initialRouteName={initialRoute}
      >
        <OnboardingStack.Screen name="VerificationPending" component={VerificationPendingScreen} />
        <OnboardingStack.Screen name="SubmitVerification" component={SubmitVerificationScreen} />
      </OnboardingStack.Navigator>
    </AppWebShell>
  );
}

export function RiderNavigator() {
  const isVerified = useAuthStore((s) => s.profile?.isVerified ?? false);

  if (!isVerified) {
    return <RiderOnboardingNavigator />;
  }

  return (
    <AppWebShell role="rider">
      <Stack.Navigator screenOptions={() => stackScreenOptions("app")}>
        <Stack.Screen name="Tabs" component={RiderTabNavigator} options={tabsStackScreenOptions} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="ActiveDelivery" component={ActiveDeliveryScreen} />
        <Stack.Screen name="PinEntry" component={PinEntryScreen} />
        <Stack.Screen name="RecordGoodsCost" component={RecordGoodsCostScreen} />
        <Stack.Screen name="SubmitVerification" component={SubmitVerificationScreen} />
      </Stack.Navigator>
      {/* Mounted only past the gate: the tour explains the job, and a rider who
          is still waiting has nothing yet to apply it to. */}
      <FirstRunTour role="rider" />
    </AppWebShell>
  );
}
