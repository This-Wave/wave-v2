import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../../navigation/StudentNavigator";
import { Button, Confirm, Field } from "../../../components/v6";
import { Illustration } from "../../../components/v7/Illustration";
import { InfoRow, TextLink, localPhone } from "../../../components/v7/InfoRows";
import { useAuthStore } from "../../../store/authStore";
import { useLoyalty } from "../../../lib/loyalty";
import { useUniversities } from "../../../lib/checkpoints";
import { useMyOrders } from "../../../lib/orders";
import { useWebPush } from "../../../hooks/useWebPush";
import { updateProfile } from "../../../lib/profile";
import { signOut } from "../../../lib/auth";
import { getLegalLinks, openLegalLink } from "../../../lib/legal";
import { hasSupportContact, openSupportContact, supportContactLabel } from "../../../lib/support";
import { BetaProgram } from "../../../components/BetaProgram";

/**
 * v7 canvas "Web you": who you are and your loyalty on the left; delivery
 * updates, your senders and the business door on the right.
 */
export function StudentProfileWeb() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const { data: loyalty } = useLoyalty();
  const { data: universities } = useUniversities();
  const { data: orders } = useMyOrders();
  const push = useWebPush();
  const legal = getLegalLinks();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [email, setEmail] = useState(profile?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const stamps = loyalty?.stamps ?? 0;
  const threshold = loyalty?.threshold ?? 6;
  const delivered = loyalty?.totalDeliveries ?? 0;
  const left = Math.max(threshold - stamps, 0);
  const line =
    loyalty?.rewardReady || loyalty?.rewardPending
      ? `${delivered} deliveries · ${loyalty.discountPct}% off your next one`
      : `${delivered} ${delivered === 1 ? "delivery" : "deliveries"} · ${left} more for ${loyalty?.discountPct ?? 20}% off`;
  const campus = universities?.find((u) => u.id === profile?.universityId)?.name;
  const senders = new Set((orders ?? []).map((o) => o.senderName).filter(Boolean)).size;
  const name = profile?.fullName ?? "Student";

  return (
    <View className="flex-1 bg-canvas" style={{ marginHorizontal: -28, paddingHorizontal: 48, paddingTop: 40 }}>
      <Text accessibilityRole="header" className="mb-6 font-display text-ink" style={{ fontSize: 48, lineHeight: 54 }}>
        You
      </Text>
      <View className="flex-row" style={{ gap: 28 }}>
        <View className="flex-1" style={{ gap: 14 }}>
          <View className="flex-row items-center" style={{ gap: 16 }}>
            <View className="h-20 w-20 items-center justify-center rounded-pill bg-wash">
              <Text className="font-display text-heading text-ink">{name.trim()[0]?.toUpperCase()}</Text>
            </View>
            <View>
              <Text className="font-sans-bold text-subheading text-ink">{name}</Text>
              <Text className="font-sans text-ui text-muted">{line}</Text>
            </View>
          </View>
          <View className="h-2.5 overflow-hidden rounded-pill bg-hairline">
            <View className="h-full rounded-pill bg-lime" style={{ width: `${Math.min(stamps / threshold, 1) * 100}%` }} />
          </View>
          <View className="rounded-card border border-hairline bg-surface px-5">
            <InfoRow label="Phone" value={localPhone(profile?.phone)} />
            {editingEmail ? (
              <View className="border-b border-hairline py-3" style={{ gap: 10 }}>
                <Field label="Email" value={email} onChangeText={setEmail} placeholder="For receipts" keyboardType="email-address" error={emailError} />
                <View className="flex-row" style={{ gap: 8 }}>
                  <Button
                    label="Save"
                    small
                    full={false}
                    loading={saving}
                    onPress={() => {
                      setSaving(true);
                      setEmailError(null);
                      void updateProfile({ email: email.trim() || null })
                        .then((next) => {
                          setProfile(next);
                          setEditingEmail(false);
                        })
                        .catch(() => setEmailError("Couldn't save email."))
                        .finally(() => setSaving(false));
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
            <InfoRow label="Payment" value="MoMo or card" onPress={() => navigation.navigate("PaymentMethods")} last />
          </View>
          <BetaProgram />
        </View>

        <View className="flex-1" style={{ gap: 14 }}>
          {push.state === "off" || push.state === "needs-install" ? (
            <View className="flex-row items-center rounded-card border border-hairline bg-surface p-5" style={{ gap: 16 }}>
              <Illustration name="pillow" width={110} height={80} />
              <View className="flex-1">
                <Text className="font-sans-bold text-subheading text-ink">Delivery updates are off</Text>
                <Text className="font-sans text-body text-muted">
                  {push.state === "needs-install"
                    ? "Add Wave to your Home Screen to get them."
                    : "Get a ping when your parcel reaches your checkpoint."}
                </Text>
              </View>
              {push.state === "off" ? <Button label="Turn on" small full={false} loading={push.busy} onPress={() => void push.turnOn()} /> : null}
            </View>
          ) : null}

          <View className="rounded-card border border-hairline bg-surface px-5">
            <InfoRow label="Saved senders" value={String(senders)} />
            <InfoRow label="Delivery updates" value={push.state === "on" ? "On" : push.state === "unsupported" ? "Not on this browser" : "Off"} />
            {hasSupportContact() ? (
              <InfoRow label="Help" value={supportContactLabel()} onPress={() => void openSupportContact()} last />
            ) : null}
          </View>

          <Pressable
            onPress={() => navigation.navigate("BusinessInterest")}
            accessibilityRole="button"
            className="flex-row items-center justify-between rounded-card border border-hairline bg-surface p-5"
          >
            <View>
              <Text className="font-sans-bold text-ui text-ink">Own a business on campus?</Text>
              <Text className="font-sans text-body text-muted">We bring your stock from Accra.</Text>
            </View>
            <Text className="font-sans-bold text-ui text-link">Tell us</Text>
          </Pressable>

          <TextLink label="Sign out" tone="muted" onPress={() => setConfirmLogout(true)} />
          {legal.terms || legal.privacy ? (
            <View className="flex-row" style={{ gap: 16 }}>
              {legal.terms ? (
                <Text accessibilityRole="link" onPress={() => void openLegalLink(legal.terms)} className="font-sans text-meta text-muted underline">Terms</Text>
              ) : null}
              {legal.privacy ? (
                <Text accessibilityRole="link" onPress={() => void openLegalLink(legal.privacy)} className="font-sans text-meta text-muted underline">Privacy</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <Confirm
        visible={confirmLogout}
        title="Log out?"
        body="You'll need your phone number and a code to get back in."
        confirmLabel="Log out"
        onConfirm={() => {
          setConfirmLogout(false);
          void signOut();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </View>
  );
}
