import { useMemo } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT } from "@wave/shared";
import { formatFullDay, upcomingRunDays } from "../../lib/pricing";

/**
 * Shown once the noon cutoff on a run day has passed.
 *
 * Nothing has gone wrong here, so there is no warning colour and no alert
 * glyph — v5 dressed this as an error state with an amber panel. It is a
 * schedule, stated plainly, with the two real options underneath.
 */
export function CutoffPassedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const nextRun = useMemo(() => upcomingRunDays(new Date(), 1)[0], []);

  return (
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-8">
          <Text className="mb-2 font-sans-bold text-heading text-ink">
            Today's run is full
          </Text>
          <Text className="mb-8 font-sans text-body text-muted">
            Orders lock at noon on a run day so runners can shop and get back before evening. The
            next standard run is {nextRun ? formatFullDay(nextRun) : "coming up"}.
          </Text>

          <View className="rounded-card bg-surface p-5">
            <Text className="mb-1 font-sans-semibold text-meta text-muted">NEED IT SOONER?</Text>
            <Text className="font-sans text-body text-ink">
              A rush order can go out ahead of the schedule for {DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}
              % more on the delivery fee — on a GH₵5 fee that's GH₵
              {((5 * DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT) / 100).toFixed(2)} extra. It needs 24
              hours' notice.
            </Text>
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-2">
          <Button label="Place a rush order" onPress={() => navigation.navigate("ShopSelection")} />
          <Button
            label="Wait for the next run"
            variant="quiet"
            onPress={() => navigation.navigate("Tabs", { screen: "Home" })}
          />
        </View>
      </ActionBar>
    </Screen>
  );
}
