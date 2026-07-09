import { useMemo } from "react";
import { SafeAreaView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Clock } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { EmptyState } from "../../components/ui/EmptyState";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT } from "@wave/shared";
import { formatFullDay, upcomingRunDays } from "../../lib/pricing";

export function CutoffPassedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const nextRun = useMemo(() => upcomingRunDays(new Date(), 1)[0], []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <EmptyState icon={Clock} title="Order Window Closed" description="Cutoff passed at 12:00 noon today.">
        <Card className="mb-2">
          <Text className="mb-1 font-sans-semibold text-[12px] text-text-secondary">Next Standard Run</Text>
          <Text className="font-sans-bold text-[14px] text-ink">{nextRun ? formatFullDay(nextRun) : "—"}</Text>
        </Card>
        <View className="rounded-well border border-warning-border bg-warning-bg p-3.5">
          <Text className="text-[12px] leading-5 text-warning-text-dark">
            Need it sooner? Place a special order for a {DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}% delivery-fee surcharge,
            with at least 24 hours advance notice.
          </Text>
        </View>
        <Button
          label={`Place Special Order (+${DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}%)`}
          variant="danger"
          onPress={() => navigation.navigate("ShopSelection")}
        />
        <Button label="Back to Home" variant="secondary" onPress={() => navigation.navigate("Tabs")} />
      </EmptyState>
    </SafeAreaView>
  );
}
