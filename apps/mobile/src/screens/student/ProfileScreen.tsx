import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { Avatar } from "../../components/ui/Avatar";
import { Dialog } from "../../components/ui/Dialog";
import { BellIcon, CardIcon, ChevronRightIcon, LogoutIcon, MessageIcon, PinIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
import { useAuthStore } from "../../store/authStore";
import { useMyOrders } from "../../lib/orders";
import { supabase } from "../../lib/supabase";
import { DEFAULT_LOYALTY_DISCOUNT_PCT, DEFAULT_LOYALTY_THRESHOLD } from "@wave/shared";
import { initialsOf } from "./orderPresenters";
import { useState, type ReactNode } from "react";

interface RowProps {
  icon: ReactNode;
  label: string;
  muted?: boolean;
  onPress?: () => void;
}

function ProfileRow({ icon, label, muted, onPress }: RowProps) {
  return (
    <Pressable
      className="flex-row items-center gap-3.5 rounded-card border border-border bg-surface p-4"
      onPress={onPress}
    >
      <View className="h-9 w-9 items-center justify-center rounded-tile bg-canvas">{icon}</View>
      <Text className={`flex-1 font-sans-semibold text-[15px] ${muted ? "text-muted" : "text-ink"}`}>{label}</Text>
      {muted ? null : <ChevronRightIcon />}
    </Pressable>
  );
}

/**
 * v5 screen 17. Identity card, the three-up stat strip (the last tile goes solid
 * green), then the settings rows. "Saved" reports the loyalty discount actually
 * earned so far rather than a decorative figure.
 */
export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: orders } = useMyOrders();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const completed = orders?.filter((o) => o.status === "delivered").length ?? 0;
  const saved = (orders ?? []).reduce((sum, o) => sum + Number(o.discountApplied), 0);
  const unlocked = completed >= DEFAULT_LOYALTY_THRESHOLD;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 128 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="mb-5 flex-row items-center gap-4 rounded-card border border-border bg-surface p-[18px]"
          style={shadowCard}
        >
          <Avatar initials={profile ? initialsOf(profile.fullName) : undefined} size={60} />
          <View className="flex-1">
            <Text className="font-sans-semibold text-[19px] text-ink" numberOfLines={1}>
              {profile?.fullName ?? "Student"}
            </Text>
            <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={1}>
              {profile?.studentId ?? profile?.phone ?? "—"}
            </Text>
          </View>
        </View>

        <View className="mb-7 flex-row gap-2.5">
          <View className="flex-1 items-center rounded-card border border-border bg-surface p-3.5">
            <Text className="font-sans-semibold text-[20px] text-wave-500">{orders?.length ?? 0}</Text>
            <Text className="text-[11px] text-muted">Orders</Text>
          </View>
          <View className="flex-1 items-center rounded-card border border-border bg-surface p-3.5">
            <Text className="font-sans-semibold text-[20px] text-wave-500">{completed}</Text>
            <Text className="text-[11px] text-muted">Delivered</Text>
          </View>
          <View className="flex-1 items-center rounded-card bg-wave-500 p-3.5">
            <Text className="font-sans-semibold text-[20px] text-wave-lime">₵{saved.toFixed(0)}</Text>
            <Text className="text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              Saved
            </Text>
          </View>
        </View>

        {!unlocked ? (
          <View className="mb-4 rounded-card border border-border bg-surface p-4">
            <Text className="font-sans-semibold text-[14px] text-ink">
              {DEFAULT_LOYALTY_THRESHOLD - completed} more deliveries to unlock {DEFAULT_LOYALTY_DISCOUNT_PCT}% off
            </Text>
            <Text className="mt-1 text-[12px] text-muted">
              {completed} of {DEFAULT_LOYALTY_THRESHOLD} completed
            </Text>
          </View>
        ) : null}

        <View className="gap-2.5">
          <ProfileRow
            icon={<CardIcon size={18} color={colors.ink} strokeWidth={1.6} />}
            label="Payment methods"
            onPress={() => navigation.navigate("PaymentMethods")}
          />
          <ProfileRow
            icon={<PinIcon size={18} color={colors.ink} strokeWidth={1.6} />}
            label="Delivery checkpoints"
          />
          <ProfileRow icon={<BellIcon size={18} />} label="Notifications" />
          <ProfileRow icon={<MessageIcon size={18} />} label="Help & support" />
          <ProfileRow icon={<LogoutIcon size={18} />} label="Log out" muted onPress={() => setConfirmLogout(true)} />
        </View>
      </ScrollView>

      <Dialog
        visible={confirmLogout}
        title="Log out of Wave?"
        description="You'll need your phone number and a fresh one-time code to sign back in."
        confirmLabel="Yes, log out"
        cancelLabel="Stay signed in"
        onConfirm={() => {
          setConfirmLogout(false);
          supabase.auth.signOut();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </SafeAreaView>
  );
}
