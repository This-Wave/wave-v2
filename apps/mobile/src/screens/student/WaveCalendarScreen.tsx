import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { HistoryIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { formatGhsCompact, upcomingRunDays } from "../../lib/pricing";
import { DEFAULT_DELIVERY_FEE_GHS, isCutoffPassedToday } from "@wave/shared";
import { useWave } from "../../lib/wave";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Pick the day, then the service (canvas board 8, redrawn 2026-11-04).
 *
 * Wave delivers every day now, at one price, so the old month calendar with
 * its rush days had nothing left to explain. What matters is today versus
 * tomorrow: two big choices first (Hick's law), then a row of later days.
 * After noon, today shows as closed and tomorrow is already picked.
 */
export function WaveCalendarScreen() {
  const navigation = useNavigation<Nav>();
  const wave = useWave();
  const now = useMemo(() => new Date(), []);
  const todayClosed = isCutoffPassedToday(now);

  // Today (if still open) plus the next nine days.
  const days = useMemo(() => upcomingRunDays(now, todayClosed ? 9 : 10), [now, todayClosed]);
  const tomorrow = useMemo(() => {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    t.setHours(0, 0, 0, 0);
    return t;
  }, [now]);
  const later = days.filter((d) => !sameDay(d, now) && !sameDay(d, tomorrow)).slice(0, 8);

  const [selected, setSelected] = useState<Date>(() => days[0] ?? tomorrow);

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text accessibilityRole="header" className="mb-6 font-sans-bold text-heading text-ink">
            When do you need it?
          </Text>

          <Text className="mb-3 font-sans-medium text-body text-ink">
            Every day · {formatGhsCompact(DEFAULT_DELIVERY_FEE_GHS)}
          </Text>
          <View accessibilityRole="radiogroup" className="mb-8 gap-2.5">
            {todayClosed ? (
              <View
                accessibilityLabel="Today, closed at noon"
                className="flex-row items-center gap-3.5 rounded-card border border-hairline bg-canvas p-4"
              >
                <HistoryIcon size={22} color={colors.muted} strokeWidth={1.8} />
                <View>
                  <Text className="font-sans-medium text-ui text-muted">Today</Text>
                  <Text className="mt-0.5 font-sans text-body text-muted">Closed at noon</Text>
                </View>
              </View>
            ) : (
              <DayOption
                title="Today"
                meta={wave ? `Closes at noon · ${wave.countdown} left` : "Closes at noon"}
                selected={sameDay(selected, now)}
                onPress={() => setSelected(days[0]!)}
              />
            )}
            <DayOption
              title="Tomorrow"
              meta={`${WEEKDAY_FULL[tomorrow.getDay()]} ${tomorrow.getDate()} ${MONTH[tomorrow.getMonth()]}${todayClosed ? " · order by noon" : ""}`}
              selected={sameDay(selected, tomorrow)}
              onPress={() => setSelected(tomorrow)}
            />
          </View>

          <Text className="mb-3 font-sans-medium text-body text-ink">Later</Text>
          <View accessibilityRole="radiogroup" className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
            {later.map((d) => {
              const isOn = sameDay(selected, d);
              return (
                <View key={d.toISOString()} style={{ width: "25%", padding: 4 }}>
                  <Pressable
                    onPress={() => setSelected(d)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isOn }}
                    accessibilityLabel={`${WEEKDAY_FULL[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`}
                    className={`h-16 items-center justify-center rounded-card active:opacity-80 ${
                      isOn ? "bg-ink" : "border border-hairline bg-surface"
                    }`}
                  >
                    <Text className={`font-sans text-meta ${isOn ? "text-white" : "text-muted"}`}>
                      {WEEKDAY[d.getDay()]}
                    </Text>
                    <Text className={`font-sans-bold text-subheading ${isOn ? "text-white" : "text-ink"}`}>
                      {d.getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Continue"
          onPress={() =>
            navigation.navigate("ChooseService", {
              scheduledDate: selected.toISOString(),
              isSpecialOrder: false,
            })
          }
        />
      </ActionBar>
    </Screen>
  );
}

function DayOption({
  title,
  meta,
  selected,
  onPress,
}: {
  title: string;
  meta: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}, ${meta}`}
      className={`flex-row items-center gap-3.5 rounded-card bg-surface p-4 active:opacity-90 ${
        selected ? "border-2 border-ink" : "border border-hairline"
      }`}
    >
      <View
        className={`h-[22px] w-[22px] items-center justify-center rounded-pill ${
          selected ? "border-[7px] border-ink" : "border-2 border-icon"
        }`}
      />
      <View className="flex-1">
        <Text className="font-sans-medium text-ui text-ink">{title}</Text>
        <Text className="mt-0.5 font-sans text-body text-muted">{meta}</Text>
      </View>
    </Pressable>
  );
}
