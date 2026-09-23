import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  BrandBar,
  Confirm,
  Field,
  Gutter,
  PageTitle,
  Screen,
  ScreenBody,
  LoyaltyStamps,
  SettingsGroup,
  SettingsRow,
} from "../../components/v6";
import {
  CardIcon,
  MenuIcon,
  LogoutIcon,
  MessageIcon,
  PinIcon,
  PlusIcon,
} from "../../components/icons";
import { colors } from "../../theme/tokens";
import { getLegalLinks, openLegalLink } from "../../lib/legal";
import { useAuthStore } from "../../store/authStore";
import { useMyOrders } from "../../lib/orders";
import { signOut } from "../../lib/auth";
import { updateProfile } from "../../lib/profile";
import { isStandardRunDay } from "../../lib/pricing";
import { useLayout } from "../../hooks/useLayout";
import { StudentProfileWeb } from "./web/StudentProfileWeb";
import {
  hasSupportContact,
  openSupportContact,
  supportContactLabel,
} from "../../lib/support";
import { BetaProgram } from "../../components/BetaProgram";
import { describeWave } from "../../lib/wave";

/**
 * Profile. Web uses a two-panel account page; native keeps the phone layout.
 */
/**
 * Suggesting from Profile has no Wave chosen, and the flow ends in an order, so
 * it needs one: the next open Wave, which the student can still change.
 */
function nextWaveParams(): { scheduledDate: string; isSpecialOrder: boolean } {
  const next = describeWave();
  const date = next?.date ?? new Date();
  return { scheduledDate: date.toISOString(), isSpecialOrder: !isStandardRunDay(date) };
}

export function ProfileScreen() {
  const { isDesktop } = useLayout();
  if (isDesktop) return <StudentProfileWeb />;
  return <ProfileMobile />;
}

function ProfileMobile() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const { data: orders } = useMyOrders();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [email, setEmail] = useState(profile?.email ?? "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const completed = (orders ?? []).filter((o) => o.status === "delivered").length;

  const legal = getLegalLinks();

  return (
    <Screen>
      <BrandBar />
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-8 pt-4">
          <PageTitle>{profile?.fullName ?? "Student"}</PageTitle>
          <Text className="mt-2 font-sans text-body text-muted">
            {[profile?.studentId, profile?.phone].filter(Boolean).join(" · ") || "—"}
          </Text>
        </Gutter>

        <Gutter className="mb-8">
          <LoyaltyStamps completed={completed} />
        </Gutter>

        <Gutter>
          {/* Email stays an editable field rather than a row that leads
              somewhere: there is no email screen to lead to, and it is the one
              setting here a student actually types into. Inside a titled group
              so it reads as part of the same list. */}
          <SettingsGroup title="Contact">
            <View className="p-4">
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@ashesi.edu.gh"
                hint="Optional — shop-live alerts when you suggest a place."
                keyboardType="email-address"
                error={emailError}
              />
              {email !== (profile?.email ?? "") ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setEmailSaving(true);
                    setEmailError(null);
                    void updateProfile({ email: email.trim() || null })
                      .then((next) => setProfile(next))
                      .catch(() => setEmailError("Couldn't save email."))
                      .finally(() => setEmailSaving(false));
                  }}
                  className="mt-3 self-start rounded-pill bg-lime px-4 py-2"
                >
                  <Text className="font-sans-semibold text-ui text-ink">
                    {emailSaving ? "Saving…" : "Save email"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </SettingsGroup>

          <SettingsGroup title="Deliveries">
            <SettingsRow
              icon={<PinIcon size={18} color={colors.ink} strokeWidth={1.8} />}
              label="Delivery checkpoints"
              value="Where your runner meets you"
              onPress={() => navigation.navigate("Checkpoints")}
            />
            <SettingsRow
              icon={<CardIcon size={18} color={colors.ink} strokeWidth={1.8} />}
              label="Payment"
              value="How you pay for deliveries"
              onPress={() => navigation.navigate("PaymentMethods")}
              last
            />
          </SettingsGroup>

          <SettingsGroup title="Wave">
            <SettingsRow
              icon={<PlusIcon size={18} color={colors.ink} strokeWidth={2} />}
              label="Suggest a shop"
              value="Somewhere you'd like Wave to buy from"
              onPress={() => navigation.navigate("SuggestShop", nextWaveParams())}
            />
            {hasSupportContact() ? (
              <SettingsRow
                icon={<MessageIcon size={18} color={colors.ink} strokeWidth={1.8} />}
                label="Help & support"
                value={supportContactLabel()}
                onPress={() => void openSupportContact()}
                last
              />
            ) : null}
          </SettingsGroup>

          {/* An application with its own states, not a row that goes
              somewhere — it stays a card of its own. */}
          <BetaProgram />

          {legal.terms || legal.privacy ? (
            <SettingsGroup title="Legal">
              {legal.terms ? (
                <SettingsRow
                  icon={<MenuIcon size={18} color={colors.ink} strokeWidth={1.8} />}
                  label="Terms of service"
                  onPress={() => void openLegalLink(legal.terms)}
                  last={!legal.privacy}
                />
              ) : null}
              {legal.privacy ? (
                <SettingsRow
                  icon={<MenuIcon size={18} color={colors.ink} strokeWidth={1.8} />}
                  label="Privacy policy"
                  onPress={() => void openLegalLink(legal.privacy)}
                  last
                />
              ) : null}
            </SettingsGroup>
          ) : null}

          <SettingsGroup title="Account">
            <SettingsRow
              icon={<LogoutIcon size={18} color={colors.danger} strokeWidth={1.8} />}
              label="Log out"
              danger
              chevron={false}
              onPress={() => setConfirmLogout(true)}
              last
            />
          </SettingsGroup>
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
