import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  Confirm,
  Gutter,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  StatusPill,
} from "../../components/v6";
import { useAuthStore } from "../../store/authStore";
import { useVerificationStatus } from "../../lib/rider";
import { useLayout } from "../../hooks/useLayout";
import { signOut } from "../../lib/auth";

function verificationPill(status?: string): {
  label: string;
  tone: "neutral" | "active" | "done" | "danger";
} {
  if (status === "approved") return { label: "Verified", tone: "done" };
  if (status === "rejected") return { label: "Rejected", tone: "danger" };
  if (status === "pending") return { label: "In review", tone: "active" };
  return { label: "Not submitted", tone: "neutral" };
}

export function RiderProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: verification } = useVerificationStatus();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const canSubmit = !verification || verification.status === "rejected";
  const pill = verificationPill(verification?.status);
  const { isDesktop } = useLayout();

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className={isDesktop ? "pb-8 pt-8" : "pb-8 pt-4"}>
          {isDesktop ? (
            <>
              <Text className="font-sans-bold text-heading text-ink">Account</Text>
              <Text className="mt-1 font-sans text-ui text-muted">
                Your runner profile and verification status.
              </Text>
            </>
          ) : (
            <>
              <PageTitle>{profile?.fullName ?? "Rider"}</PageTitle>
              <Text className="mt-2 font-sans text-body text-muted">{profile?.phone ?? "—"}</Text>
            </>
          )}
        </Gutter>

        <Gutter>
          <View className={isDesktop ? "flex-row flex-wrap" : undefined} style={isDesktop ? { gap: 24 } : undefined}>
            <View
              className={`rounded-card bg-surface p-5 ${isDesktop ? "" : "mb-8"}`}
              style={isDesktop ? { flex: 1, minWidth: 280 } : undefined}
            >
              {isDesktop ? (
                <>
                  <Text className="font-sans-bold text-heading-sm text-ink">
                    {profile?.fullName ?? "Rider"}
                  </Text>
                  <Text className="mt-2 font-sans text-body text-muted">{profile?.phone ?? "—"}</Text>
                </>
              ) : null}
              <View className={isDesktop ? "mt-6 border-t border-hairline pt-5" : undefined}>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="font-sans-semibold text-meta text-muted">VERIFICATION</Text>
                  <StatusPill label={pill.label} tone={pill.tone} />
                </View>
                <Text className="font-sans text-body text-ink">
                  {verification?.status === "approved"
                    ? "You're cleared to take orders. Nothing else to do."
                    : verification?.status === "pending"
                      ? "Wave is checking your ID. You'll be able to take orders once it's approved."
                      : verification?.status === "rejected"
                        ? "Your submission was turned down. Send a clearer ID photo and selfie."
                        : "Send an ID photo and a selfie before you can take orders."}
                </Text>
              </View>
            </View>

            <View style={isDesktop ? { flex: 1, minWidth: 280 } : undefined}>
              <RowGroup>
                {canSubmit ? (
                  <Row
                    title={
                      verification?.status === "rejected" ? "Resubmit your ID" : "Submit your ID"
                    }
                    meta="Photo of your ID plus a selfie"
                    onPress={() => navigation.navigate("SubmitVerification")}
                  />
                ) : null}
              </RowGroup>

              <View className="mt-8">
                <Row title="Log out" onPress={() => setConfirmLogout(true)} chevron={false} />
              </View>
            </View>
          </View>
        </Gutter>
      </ScreenBody>

      <Confirm
        visible={confirmLogout}
        title="Log out?"
        body="You'll need your phone number and a code to get back in."
        confirmLabel="Log out"
        onConfirm={() => {
          setConfirmLogout(false);
          // `lib/auth.ts` is the ONLY place that may call supabase.auth.signOut()
          // — it detaches the push token first.
          void signOut();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </Screen>
  );
}
