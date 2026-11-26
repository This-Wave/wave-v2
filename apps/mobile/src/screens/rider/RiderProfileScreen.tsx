import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  Switch,
  Confirm,
  Gutter,
  PageTitle,
  Screen,
  ScreenBody,
} from "../../components/v6";
import { useAuthStore } from "../../store/authStore";
import { useMyDeliveries, useSetAvailability, useVerificationStatus } from "../../lib/rider";
import { InfoRow, TextLink, localPhone } from "../../components/v7/InfoRows";
import { signOut } from "../../lib/auth";
import {
  hasSupportContact,
  openSupportContact,
} from "../../lib/support";
import { BetaProgram } from "../../components/BetaProgram";

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
  const { data: deliveries } = useMyDeliveries();
  const done = (deliveries ?? []).filter((o) => o.status === "delivered").length;
  const setAvailability = useSetAvailability();
  const [online, setOnline] = useState(profile?.isAvailable ?? true);
  const name = profile?.fullName ?? "Rider";

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-5 pt-6">
          <PageTitle>You</PageTitle>
        </Gutter>

        <Gutter style={{ gap: 12 }}>
          {/* v7 canvas: who you are and your standing, then the one switch a
              rider uses every day, then the plain facts. */}
          <View className="mb-1 flex-row items-center" style={{ gap: 14 }}>
            <View className="h-16 w-16 items-center justify-center rounded-pill bg-wash">
              <Text className="font-display text-heading text-ink">{name.trim()[0]?.toUpperCase()}</Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-sans-bold text-subheading text-ink" numberOfLines={1}>{name}</Text>
              <Text className="font-sans text-body text-muted">
                {pill.label === "Verified" ? "Verified rider" : pill.label} · {done} {done === 1 ? "delivery" : "deliveries"}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center rounded-card border border-hairline bg-surface p-4" style={{ gap: 12 }}>
            <View className="min-w-0 flex-1">
              <Text className="font-sans-bold text-ui text-ink">Available for jobs</Text>
              <Text className="font-sans text-meta text-muted">Turn off when you're done</Text>
            </View>
            <Switch
              value={online}
              onValueChange={(v) => {
                setOnline(v);
                setAvailability.mutate(v);
              }}
              accessibilityLabel="Available for jobs"
            />
          </View>

          <View className="rounded-card border border-hairline bg-surface px-4">
            <InfoRow label="Phone" value={localPhone(profile?.phone)} />
            <InfoRow label="Paid to" value="Mobile Money" />
            <InfoRow label="Verification" value={pill.label} last />
          </View>

          <View style={{ gap: 2 }}>
            {canSubmit ? (
              <TextLink
                label={verification?.status === "rejected" ? "Send your ID again" : "Submit your ID"}
                onPress={() => navigation.navigate("SubmitVerification")}
              />
            ) : null}
            {hasSupportContact() ? <TextLink label="Help" onPress={() => void openSupportContact()} /> : null}
            <TextLink label="Sign out" tone="muted" onPress={() => setConfirmLogout(true)} />
          </View>

          <BetaProgram />
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
