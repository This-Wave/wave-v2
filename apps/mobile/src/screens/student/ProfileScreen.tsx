import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Bell, ChevronRight, LogOut, Package, Settings } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { ListRow } from "../../components/ui/ListRow";
import { useAuthStore } from "../../store/authStore";
import { useMyOrders } from "../../lib/orders";
import { supabase } from "../../lib/supabase";
import { DEFAULT_LOYALTY_DISCOUNT_PCT, DEFAULT_LOYALTY_THRESHOLD } from "@wave/shared";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: orders } = useMyOrders();
  const completed = orders?.filter((o) => o.status === "delivered").length ?? 0;
  const unlocked = completed >= DEFAULT_LOYALTY_THRESHOLD;

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView className="flex-1 px-6 pt-3" contentContainerStyle={{ paddingBottom: 24 }}>
        <Card className="mb-3 flex-row items-center gap-3.5 bg-surface">
          <Avatar initials={profile ? initials(profile.fullName) : undefined} size={64} />
          <View>
            <Text className="font-sans-extrabold text-[18px] text-ink">{profile?.fullName}</Text>
            <Text className="mt-0.5 font-mono text-[12px] text-muted">{profile?.studentId ?? "—"}</Text>
          </View>
        </Card>

        <Card className="mb-3 border-[1.5px] border-wave-500 bg-surface">
          <Text className="mb-1 font-sans-bold text-[13px] text-ink">Loyalty Rewards</Text>
          <Text className="mb-3 text-[11px] text-muted">
            {DEFAULT_LOYALTY_DISCOUNT_PCT}% off delivery fee{unlocked ? " · Active now" : ""}
          </Text>
          <ProgressBar progress={completed / DEFAULT_LOYALTY_THRESHOLD} />
          <Text className="mt-2 text-[11px] text-muted">
            {completed} deliveries completed / {DEFAULT_LOYALTY_THRESHOLD} required
          </Text>
        </Card>

        <View className="overflow-hidden rounded-well border border-border bg-surface">
          <ListRow
            bordered
            leading={<Package size={18} color="#555" />}
            title="Order History"
            trailing={<ChevronRight size={16} color="#9E9E9E" />}
            onPress={() => navigation.navigate("Tabs", { screen: "Orders" })}
          />
          <ListRow bordered leading={<Bell size={18} color="#555" />} title="Notifications" trailing={<ChevronRight size={16} color="#9E9E9E" />} />
          <ListRow leading={<Settings size={18} color="#555" />} title="Settings" trailing={<ChevronRight size={16} color="#9E9E9E" />} />
        </View>

        <View className="mt-3 overflow-hidden rounded-well border border-border bg-surface">
          <ListRow leading={<LogOut size={18} color="#D32F2F" />} title="Log Out" danger onPress={() => supabase.auth.signOut()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
