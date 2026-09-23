import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../../navigation/StudentNavigator";
import {
  LoyaltyStamps,
  SettingsGroup,
  SettingsRow,
  Confirm,
  Gutter,
  Screen,
  ScreenBody,
} from "../../../components/v6";
import { useAuthStore } from "../../../store/authStore";
import { useMyOrders } from "../../../lib/orders";
import { signOut } from "../../../lib/auth";
import { formatGhs, isStandardRunDay } from "../../../lib/pricing";
import { openPaymentMethods } from "../../../lib/desktopNavigate";
import { DEFAULT_LOYALTY_THRESHOLD } from "@wave/shared";
import {
  hasSupportContact,
  openSupportContact,
  supportContactLabel,
} from "../../../lib/support";
import { BetaProgram } from "../../../components/BetaProgram";
import {
  CardIcon,
  LogoutIcon,
  MenuIcon,
  MessageIcon,
  PinIcon,
  PlusIcon,
} from "../../../components/icons";
import { colors } from "../../../theme/tokens";
import { getLegalLinks, openLegalLink } from "../../../lib/legal";
import { useLoyalty } from "../../../lib/loyalty";
import { describeWave } from "../../../lib/wave";

/** Desktop profile — account panel + settings column. */
/**
 * Suggesting from Profile has no Wave chosen, and the flow ends in an order, so
 * it needs one: the next open Wave, which the student can still change.
 */
function nextWaveParams(): { scheduledDate: string; isSpecialOrder: boolean } {
  const next = describeWave();
  const date = next?.date ?? new Date();
  return { scheduledDate: date.toISOString(), isSpecialOrder: !isStandardRunDay(date) };
}

export function StudentProfileWeb() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: orders } = useMyOrders();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const completed = (orders ?? []).filter((o) => o.status === "delivered").length;
  const saved = (orders ?? []).reduce((sum, o) => {
    const pct = Number(o.discountApplied ?? 0);
    const fee = Number(o.deliveryFee ?? 0);
    return sum + (fee * pct) / 100;
  }, 0);
  const unlocked = completed >= DEFAULT_LOYALTY_THRESHOLD;
  const legal = getLegalLinks();
  const { data: loyalty } = useLoyalty();

  return (
    <Screen>
      <ScreenBody bottomInset={48}>
        <Gutter className="pb-8 pt-8">
          <Text className="font-sans-bold text-heading text-ink">Account</Text>
          <Text className="mt-1 font-sans text-ui text-muted">
            Your Wave profile and delivery preferences.
          </Text>
        </Gutter>

        <Gutter>
          <View className="flex-row flex-wrap" style={{ gap: 24 }}>
            <View className="rounded-card bg-surface p-6" style={{ flex: 1, minWidth: 280 }}>
              <Text className="font-sans-bold text-heading-sm text-ink">
                {profile?.fullName ?? "Student"}
              </Text>
              <Text className="mt-2 font-sans text-body text-muted">
                {[profile?.studentId, profile?.phone].filter(Boolean).join(" · ") || "—"}
              </Text>

              {/* The same stamp card as the phone, so the discount looks like
                  one thing across both layouts. The amount saved is web-only:
                  there is room for it here and it is the payoff the stamps are
                  working towards. */}
              <View className="mt-6 border-t border-hairline pt-5">
                <LoyaltyStamps
                  stamps={loyalty?.stamps ?? 0}
                  threshold={loyalty?.threshold}
                  discountPct={loyalty?.discountPct}
                  pending={loyalty?.rewardPending}
                />
                {unlocked && saved > 0 ? (
                  <Text className="mt-3 font-sans text-body text-muted">
                    Saved <Text className="font-sans-semibold text-ink">{formatGhs(saved)}</Text>{" "}
                    across {completed} deliveries.
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 280 }}>
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
                  onPress={() => openPaymentMethods(navigation)}
                  last
                />
              </SettingsGroup>

              <SettingsGroup title="Wave">
                <SettingsRow
                  icon={<PlusIcon size={18} color={colors.ink} strokeWidth={2} />}
                  label="Suggest a shop"
                  value="Somewhere you'd like Wave to buy from"
                  onPress={() => navigation.navigate("SuggestShop", nextWaveParams())}
                  last={!hasSupportContact()}
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
          void signOut();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </Screen>
  );
}
