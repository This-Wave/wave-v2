import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronRight, LogOut, ShieldCheck } from "lucide-react-native";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { ListRow } from "../../components/ui/ListRow";
import { useAuthStore } from "../../store/authStore";
import { useVerificationStatus } from "../../lib/rider";
import { supabase } from "../../lib/supabase";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function verificationBadge(status?: string): { label: string; variant: "success" | "error" | "warning" | "neutral" } {
  if (status === "approved") return { label: "Verified", variant: "success" };
  if (status === "rejected") return { label: "Rejected", variant: "error" };
  if (status === "pending") return { label: "Pending Review", variant: "warning" };
  return { label: "Not Submitted", variant: "neutral" };
}

export function RiderProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: verification } = useVerificationStatus();
  const canSubmit = !verification || verification.status === "rejected";

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView className="flex-1 px-6 pt-3" contentContainerStyle={{ paddingBottom: 24 }}>
        <Card className="mb-3 flex-row items-center gap-3.5 bg-surface">
          <Avatar initials={profile ? initials(profile.fullName) : undefined} size={64} />
          <View>
            <Text className="font-sans-extrabold text-[18px] text-ink">{profile?.fullName}</Text>
            <Text className="mt-0.5 text-[12px] text-muted">{profile?.phone}</Text>
          </View>
        </Card>

        <Pressable
          disabled={!canSubmit}
          onPress={() => navigation.navigate("SubmitVerification")}
          className="mb-3"
        >
          <Card className="bg-surface">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={16} color="#555" />
                <Text className="font-sans-bold text-[13px] text-ink">Verification</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Badge {...verificationBadge(verification?.status)} />
                {canSubmit ? <ChevronRight size={16} color="#9E9E9E" /> : null}
              </View>
            </View>
            {canSubmit ? (
              <Text className="mt-2 text-[11px] text-muted">
                {verification?.status === "rejected" ? "Tap to resubmit your ID and selfie." : "Tap to submit your ID and selfie for review."}
              </Text>
            ) : null}
          </Card>
        </Pressable>

        <View className="overflow-hidden rounded-well border border-border bg-surface">
          <ListRow leading={<LogOut size={18} color="#D32F2F" />} title="Log Out" danger onPress={() => supabase.auth.signOut()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
