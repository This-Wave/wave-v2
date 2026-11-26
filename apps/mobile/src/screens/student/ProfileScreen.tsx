import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  Button,
  Switch,
  Confirm,
  Field,
  Gutter,
  PageTitle,
  Screen,
  ScreenBody,
} from "../../components/v6";
import { getLegalLinks, openLegalLink } from "../../lib/legal";
import { useAuthStore } from "../../store/authStore";
import { useLoyalty } from "../../lib/loyalty";
import { signOut } from "../../lib/auth";
import { updateProfile } from "../../lib/profile";
import { useLayout } from "../../hooks/useLayout";
import { StudentProfileWeb } from "./web/StudentProfileWeb";
import {
  hasSupportContact,
  openSupportContact,
  supportContactLabel,
} from "../../lib/support";
import { BetaProgram } from "../../components/BetaProgram";
import { InfoRow, TextLink, localPhone } from "../../components/v7/InfoRows";
import { useUniversities } from "../../lib/checkpoints";
import { useWebPush } from "../../hooks/useWebPush";

/**
 * Profile. Web uses a two-panel account page; native keeps the phone layout.
 */
/**
 * Suggesting from Profile has no Wave chosen, and the flow ends in an order, so
 * it needs one: the next open Wave, which the student can still change.
 */
export function ProfileScreen() {
  const { isDesktop } = useLayout();
  if (isDesktop) return <StudentProfileWeb />;
  return <ProfileMobile />;
}

function ProfileMobile() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const { data: loyalty } = useLoyalty();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [email, setEmail] = useState(profile?.email ?? "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const legal = getLegalLinks();
  const [editingEmail, setEditingEmail] = useState(false);
  const { data: universities } = useUniversities();
  const push = useWebPush();

  const stamps = loyalty?.stamps ?? 0;
  const threshold = loyalty?.threshold ?? 6;
  const delivered = loyalty?.totalDeliveries ?? 0;
  const left = Math.max(threshold - stamps, 0);
  const loyaltyLine = loyalty?.rewardReady || loyalty?.rewardPending
    ? `${delivered} deliveries · ${loyalty.discountPct}% off your next one`
    : `${delivered} ${delivered === 1 ? "delivery" : "deliveries"} · ${left} more for ${loyalty?.discountPct ?? 20}% off`;
  const campus = universities?.find((u) => u.id === profile?.universityId)?.name;
  const first = (profile?.fullName ?? "S").trim();

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-5 pt-6">
          <PageTitle>You</PageTitle>
        </Gutter>

        <Gutter className="flex-row items-center pb-4" style={{ gap: 14 }}>
          <View className="h-16 w-16 items-center justify-center rounded-pill bg-wash">
            <Text className="font-display text-heading text-ink">{first[0]?.toUpperCase()}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-sans-bold text-subheading text-ink" numberOfLines={1}>
              {profile?.fullName ?? "Student"}
            </Text>
            <Text className="font-sans text-body text-muted">{loyaltyLine}</Text>
          </View>
        </Gutter>

        <Gutter className="mb-3">
          <View
            className="h-2.5 overflow-hidden rounded-pill bg-hairline"
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: threshold, now: Math.min(stamps, threshold) }}
          >
            <View className="h-full rounded-pill bg-lime" style={{ width: `${Math.min(stamps / threshold, 1) * 100}%` }} />
          </View>
        </Gutter>

        <Gutter>
          <InfoRow label="Name" value={profile?.fullName} />
          <InfoRow label="Phone" value={localPhone(profile?.phone)} />
          {editingEmail ? (
            <View className="border-b border-hairline py-3">
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="For receipts"
                keyboardType="email-address"
                error={emailError}
              />
              <View className="mt-3 flex-row" style={{ gap: 8 }}>
                <Button
                  label={emailSaving ? "Saving" : "Save"}
                  small
                  full={false}
                  loading={emailSaving}
                  onPress={() => {
                    setEmailSaving(true);
                    setEmailError(null);
                    void updateProfile({ email: email.trim() || null })
                      .then((next) => {
                        setProfile(next);
                        setEditingEmail(false);
                      })
                      .catch(() => setEmailError("Couldn't save email."))
                      .finally(() => setEmailSaving(false));
                  }}
                />
                <Button label="Cancel" variant="quiet" small full={false} onPress={() => setEditingEmail(false)} />
              </View>
            </View>
          ) : (
            <InfoRow label="Email" value={profile?.email || "Add"} onPress={() => setEditingEmail(true)} />
          )}
          <InfoRow label="Campus" value={campus ?? "Ashesi University"} />
          <InfoRow label="Pickup point" value="Change" onPress={() => navigation.navigate("Checkpoints")} />
          <InfoRow label="Payment" value="MoMo or card" onPress={() => navigation.navigate("PaymentMethods")} />
          {push.state === "on" || push.state === "off" ? (
            <InfoRow
              label="Delivery updates"
              trailing={
                <Switch
                  value={push.state === "on"}
                  disabled={push.busy}
                  accessibilityLabel="Delivery updates"
                  onValueChange={(next) => (next ? push.turnOn() : push.turnOff())}
                />
              }
            />
          ) : push.state === "needs-install" ? (
            <InfoRow label="Delivery updates" value="Add Wave to your Home Screen" />
          ) : null}
          {hasSupportContact() ? (
            <InfoRow label="Help" value={supportContactLabel()} onPress={() => void openSupportContact()} last />
          ) : null}

          <View className="mt-4" style={{ gap: 2 }}>
            <TextLink label="Own a business on campus?" onPress={() => navigation.navigate("BusinessInterest")} />
            <TextLink label="Sign out" tone="muted" onPress={() => setConfirmLogout(true)} />
          </View>

          <View className="mt-6">
            <BetaProgram />
          </View>

          {legal.terms || legal.privacy ? (
            <View className="mt-4 flex-row" style={{ gap: 16 }}>
              {legal.terms ? (
                <Text accessibilityRole="link" onPress={() => void openLegalLink(legal.terms)} className="font-sans text-meta text-muted underline">
                  Terms
                </Text>
              ) : null}
              {legal.privacy ? (
                <Text accessibilityRole="link" onPress={() => void openLegalLink(legal.privacy)} className="font-sans text-meta text-muted underline">
                  Privacy
                </Text>
              ) : null}
            </View>
          ) : null}
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
          // — it detaches the push token first, so a logged-out device stops
          // receiving notifications.
          void signOut();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </Screen>
  );
}
