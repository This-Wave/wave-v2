import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderOnboardingStackParamList } from "../../navigation/RiderNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody } from "../../components/v6";
import { useVerificationStatus } from "../../lib/rider";
import { fetchMyProfile } from "../../lib/profile";
import { useAuthStore } from "../../store/authStore";
import { signOut } from "../../lib/auth";
import { hasSupportContact, openSupportContact } from "../../lib/support";
import { Illustration } from "../../components/v7/Illustration";

/**
 * Where a rider waits.
 *
 * This is the whole app for an unverified rider — `RiderNavigator` mounts an
 * onboarding stack instead of the tabs until `profile.isVerified` is true.
 * Before onboarding existed there was no gate at all: a new rider saw the live
 * order feed, including other students' names and checkpoints, and every tap on
 * Accept returned an unexplained failure, because `orders/routes.ts` has always
 * rejected an unverified rider. Blocking here is both the honest version of that
 * and the one that does not hand real customer data to someone unvetted.
 *
 * "Check status" refetches the *profile*, not just the verification row. An
 * admin approving a rider writes `isVerified` on the profile, and that flag is
 * what the gate reads — polling only the verification row would show "approved"
 * while the app still refused to let them in.
 */
export function VerificationPendingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderOnboardingStackParamList>>();
  const { data: verification, refetch, isFetching } = useVerificationStatus();
  const setProfile = useAuthStore((s) => s.setProfile);
  const [checking, setChecking] = useState(false);

  async function handleCheck() {
    setChecking(true);
    try {
      await refetch();
      const profile = await fetchMyProfile();
      // Setting a now-verified profile re-renders RootNavigator straight into
      // the rider tabs, so there is no success state to render here.
      setProfile(profile);
    } catch {
      // Nothing useful to say — the copy below already tells them to check later.
    } finally {
      setChecking(false);
    }
  }

  const rejected = verification?.status === "rejected";

  return (
    <Screen>
      <ScreenBody bottomInset={16}>
        {/* v7 canvas: the waiting illustration and one plain line. */}
        <Gutter className="items-center pt-16" style={{ gap: 12 }}>
          <Illustration name="pillow" width={230} height={160} />
          <Text accessibilityRole="header" className="text-center font-display text-heading text-ink">
            {rejected ? "We couldn't verify you" : "We're checking your ID"}
          </Text>
          <Text className="text-center font-sans text-ui text-muted">
            {rejected ? "You can fix it and send your documents again." : "Usually within a day. We'll text you."}
          </Text>
          {rejected && verification?.rejectionReason ? (
            <View className="mt-2 self-stretch rounded-card bg-wash p-4">
              <Text className="font-sans-bold text-body text-ink">Reason given</Text>
              <Text className="mt-1 font-sans text-body text-ink-700">{verification.rejectionReason}</Text>
            </View>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View style={{ gap: 4 }}>
          {rejected ? (
            <Button label="Send documents again" onPress={() => navigation.navigate("SubmitVerification")} />
          ) : hasSupportContact() ? (
            <Button label="Contact support" variant="ghost" onPress={() => void openSupportContact()} />
          ) : null}
          {!rejected ? (
            <Button label="Check status" variant="quiet" onPress={handleCheck} loading={checking || isFetching} />
          ) : null}
          <Button label="Sign out" variant="quiet" onPress={() => void signOut()} />
        </View>
      </ActionBar>
    </Screen>
  );
}
