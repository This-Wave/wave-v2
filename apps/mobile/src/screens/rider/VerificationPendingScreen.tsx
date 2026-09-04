import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderOnboardingStackParamList } from "../../navigation/RiderNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody } from "../../components/v6";
import { useVerificationStatus } from "../../lib/rider";
import { fetchMyProfile } from "../../lib/profile";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";

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
        <Gutter className="pt-16">
          <Text className="mb-2 font-sans-bold text-heading text-ink">
            {rejected ? "We couldn't verify you" : "Verification submitted"}
          </Text>

          {rejected ? (
            <>
              <Text className="mb-6 font-sans text-body text-muted">
                An admin reviewed your documents and couldn&apos;t approve them. You can fix the
                problem and send them again.
              </Text>
              {verification?.rejectionReason ? (
                <View className="mb-6 rounded-card bg-surface px-4 py-3.5">
                  <Text className="mb-1 font-sans-medium text-body text-ink">Reason given</Text>
                  <Text className="font-sans text-body text-muted">
                    {verification.rejectionReason}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text className="mb-6 font-sans text-body text-muted">
              An admin is reviewing your ID. This usually takes about a day. We&apos;ll let you know
              as soon as you&apos;re approved — you can close the app.
            </Text>
          )}

          <View className="rounded-card bg-surface px-4 py-3.5">
            <Text className="mb-1 font-sans-medium text-body text-ink">Why we check</Text>
            <Text className="font-sans text-body text-muted">
              Riders handle other people&apos;s money and shopping, so every rider is identified
              before taking a first order.
            </Text>
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-2">
          {rejected ? (
            <Button
              label="Send documents again"
              onPress={() => navigation.navigate("SubmitVerification")}
            />
          ) : (
            <Button
              label="Check status"
              onPress={handleCheck}
              loading={checking || isFetching}
              variant="primary"
            />
          )}
          <Button label="Sign out" variant="ghost" onPress={() => void supabase.auth.signOut()} />
        </View>
      </ActionBar>
    </Screen>
  );
}
