import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { ListRow } from "../../components/ui/ListRow";
import { ChevronRightIcon, LogoutIcon, ShieldIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
import { useAuthStore } from "../../store/authStore";
import { useMyDeliveries, useRiderEarnings, useVerificationStatus } from "../../lib/rider";
import { formatGhsCompact } from "../../lib/pricing";
import { supabase } from "../../lib/supabase";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function verificationBadge(status?: string): {
  label: string;
  variant: "success" | "error" | "warning" | "neutral";
} {
  if (status === "approved") return { label: "Verified", variant: "success" };
  if (status === "rejected") return { label: "Rejected", variant: "error" };
  if (status === "pending") return { label: "Pending review", variant: "warning" };
  return { label: "Not submitted", variant: "neutral" };
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View className="flex-1 rounded-card border border-border bg-surface p-4">
      <Text
        className={`font-sans-semibold text-[24px] tracking-tight ${accent ? "text-wave-500" : "text-ink"}`}
      >
        {value}
      </Text>
      <Text className="mt-1 font-sans-medium text-[11px] text-muted">{label}</Text>
    </View>
  );
}

export function RiderProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: verification } = useVerificationStatus();
  const { data: deliveries } = useMyDeliveries();
  const { data: earnings } = useRiderEarnings();
  const canSubmit = !verification || verification.status === "rejected";

  const deliveredCount = (deliveries ?? []).filter((o) => o.status === "delivered").length;
  const earnedTotal = (earnings ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingTotal = (earnings ?? [])
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 128 }}>
        <Text className="mb-5 font-sans-semibold text-[22px] tracking-tight text-ink">Profile</Text>

        <View
          className="mb-3 flex-row items-center gap-4 rounded-card border border-border bg-surface p-5"
          style={shadowCard}
        >
          <Avatar initials={profile ? initials(profile.fullName) : undefined} size={64} />
          <View className="flex-1">
            <Text className="font-sans-semibold text-[18px] text-ink">{profile?.fullName}</Text>
            <Text className="mt-1 text-[13px] text-muted">{profile?.phone}</Text>
          </View>
        </View>

        {/* Design R07 shows a rating tile; nothing in the schema records rider
            ratings, so this reports pending payout instead of inventing a number. */}
        <View className="mb-3 flex-row gap-2.5">
          <Stat value={String(deliveredCount)} label="Deliveries" />
          <Stat value={formatGhsCompact(earnedTotal)} label="Earned" accent />
          <Stat value={formatGhsCompact(pendingTotal)} label="Pending" />
        </View>

        <Pressable
          disabled={!canSubmit}
          onPress={() => navigation.navigate("SubmitVerification")}
          className="mb-3 rounded-card border border-border bg-surface p-[18px]"
          style={shadowCard}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <ShieldIcon size={18} color={colors.muted} />
              <Text className="font-sans-semibold text-[15px] text-ink">Verification</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Badge {...verificationBadge(verification?.status)} />
              {canSubmit ? <ChevronRightIcon size={16} color={colors.muted} /> : null}
            </View>
          </View>
          {canSubmit ? (
            <Text className="mt-2.5 text-[11px] text-muted">
              {verification?.status === "rejected"
                ? "Tap to resubmit your ID and selfie."
                : "Tap to submit your ID and selfie for review."}
            </Text>
          ) : null}
        </Pressable>

        <View className="overflow-hidden rounded-card border border-border bg-surface" style={shadowCard}>
          <ListRow
            leading={<LogoutIcon size={18} color={colors.danger} />}
            title="Log out"
            danger
            onPress={() => supabase.auth.signOut()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
