import { useMemo } from "react";
import { SafeAreaView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Button } from "../../components/ui/Button";
import { AlertIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT } from "@wave/shared";
import { formatFullDay, upcomingRunDays } from "../../lib/pricing";

/**
 * v5 screen 19 error state, applied to the noon cutoff — warning-toned rather
 * than destructive, since nothing has gone wrong.
 */
export function CutoffPassedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const nextRun = useMemo(() => upcomingRunDays(new Date(), 1)[0], []);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Order window" onBack={() => navigation.goBack()} />

      <View className="flex-1 items-center justify-center px-10">
        <View className="mb-6 h-[84px] w-[84px] items-center justify-center rounded-card bg-warning-bg">
          <AlertIcon color={colors.warning} />
        </View>
        <Text className="mb-2.5 text-center font-sans-semibold text-[20px] text-ink">Today&apos;s run is closed</Text>
        <Text className="mb-6 text-center text-[14px] leading-[21px] text-muted">
          Orders lock at 12:00 noon on a run day. The next standard run is{" "}
          {nextRun ? formatFullDay(nextRun) : "coming up"}.
        </Text>

        <View className="mb-7 w-full rounded-card border border-warning-border bg-warning-bg p-4">
          <Text className="text-[13px] leading-5 text-warning-text-dark">
            Need it sooner? A special order runs today for a {DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}% delivery-fee
            surcharge, with at least 24 hours&apos; notice.
          </Text>
        </View>

        <View className="w-full gap-3">
          <Button
            label={`Place special order · +${DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}%`}
            onPress={() => navigation.navigate("ShopSelection")}
          />
          <Button
            label="Back to home"
            variant="secondary"
            size="compact"
            onPress={() => navigation.navigate("Tabs", { screen: "Home" })}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
