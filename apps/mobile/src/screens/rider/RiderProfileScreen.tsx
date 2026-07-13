import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { LogOut, ShieldCheck } from "lucide-react-native";
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
  const profile = useAuthStore((s) => s.profile);
  const { data: verification } = useVerificationStatus();

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

        <Card className="mb-3 bg-surface">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <ShieldCheck size={16} color="#555" />
              <Text className="font-sans-bold text-[13px] text-ink">Verification</Text>
            </View>
            <Badge {...verificationBadge(verification?.status)} />
          </View>
        </Card>

        <View className="overflow-hidden rounded-well border border-border bg-surface">
          <ListRow leading={<LogOut size={18} color="#D32F2F" />} title="Log Out" danger onPress={() => supabase.auth.signOut()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
