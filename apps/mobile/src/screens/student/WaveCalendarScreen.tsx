import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  Calendar,
  Gutter,
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { classifyMonth, formatFullDay, isStandardRunDay } from "../../lib/pricing";
import { DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT } from "@wave/shared";
import { useWave } from "../../lib/wave";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

/**
 * Pick the day, then pick the service.
 *
 * This screen exists because the countdown on Home was a dead end — it showed
 * the deadline for the *next* Wave and, when tapped, dropped you into the shop
 * list with no way to say "not that one, the Wednesday after". A student
 * planning ahead had no route to a later Wave at all, and the rush option was
 * buried one screen deeper as a single unexplained chip.
 *
 * Order of questions matters: the day constrains everything downstream (whether
 * a surcharge applies, which shops are worth showing), so it is asked first.
 */
export function WaveCalendarScreen() {
  const navigation = useNavigation<Nav>();
  const wave = useWave();

  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  // Default to the next open Wave, so the common case is one tap: Continue.
  const [selected, setSelected] = useState<Date | null>(() => wave?.date ?? null);

  const days = useMemo(() => classifyMonth(month, today), [month, today]);

  const isRush = !!selected && !isStandardRunDay(selected);
  const canGoBack =
    month.getFullYear() > today.getFullYear() ||
    (month.getFullYear() === today.getFullYear() && month.getMonth() > today.getMonth());

  function shiftMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text className="mb-2 font-sans-bold text-heading text-ink">When do you need it?</Text>
          <Text className="mb-6 font-sans text-body text-muted">
            Wave runs every Sunday and Wednesday. Orders close at noon on the day itself. Any other
            day is a rush order.
          </Text>

          <Calendar
            month={month}
            days={days}
            selected={selected}
            onSelect={setSelected}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            canGoBack={canGoBack}
          />

          {selected ? (
            <View className="mt-5 rounded-card bg-surface p-4">
              <Text className="font-sans-medium text-body text-ink">
                {formatFullDay(selected)}
              </Text>
              <Text className="mt-1 font-sans text-body text-muted">
                {isRush
                  ? `Rush order — ${DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}% more on the delivery fee, and we need a day's notice.`
                  : "Standard Wave. No surcharge."}
              </Text>
            </View>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Continue"
          disabled={!selected}
          onPress={() =>
            navigation.navigate("ChooseService", {
              scheduledDate: selected!.toISOString(),
              isSpecialOrder: isRush,
            })
          }
        />
      </ActionBar>
    </Screen>
  );
}
