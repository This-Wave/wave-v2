import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type DayKind = "standard" | "rush" | "disabled";

export interface CalendarDay {
  date: Date;
  kind: DayKind;
}

/**
 * A month grid for choosing which Wave to join.
 *
 * Three states, and the visual weight is deliberately ordered to match how
 * often each is the right answer:
 *
 *  - **standard** — a Sunday or Wednesday still open. Lime fill, ink numeral.
 *    These are the days Wave actually runs, so they are the only filled cells.
 *  - **rush** — any other future day, delivered at a surcharge. Outlined, not
 *    filled: available, but visibly not the default.
 *  - **disabled** — the past, and today once the noon cutoff has gone.
 *
 * The selected day inverts to the ink ground so it reads as chosen rather than
 * merely available — lime-on-lime would make "selectable" and "selected"
 * the same colour, which is the one distinction this screen exists to make.
 */
export function Calendar({
  month,
  days,
  selected,
  onSelect,
  onPrevMonth,
  onNextMonth,
  canGoBack,
}: {
  month: Date;
  days: CalendarDay[];
  selected: Date | null;
  onSelect: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canGoBack: boolean;
}) {
  // Blank cells so the 1st lands under its real weekday. Without these the
  // whole month shifts and every date reads as the wrong day.
  const leadingBlanks = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    return first.getDay();
  }, [month]);

  return (
    // Capped and centred. Day cells are `aspect-square` at 1/7 width, so on a
    // tablet or Expo Web the grid would otherwise grow to a full-screen square
    // of 200px circles. 420px is about a large phone's width — the size the
    // layout was designed at.
    <View className="w-full self-center rounded-card bg-surface p-4" style={{ maxWidth: 420 }}>
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable
          onPress={onPrevMonth}
          disabled={!canGoBack}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !canGoBack }}
          className="h-9 w-9 items-center justify-center rounded-pill active:bg-canvas"
        >
          <ChevronLeftIcon size={18} color={canGoBack ? colors.ink : colors.subtle} />
        </Pressable>

        <Text className="font-sans-medium text-ui text-ink">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Text>

        <Pressable
          onPress={onNextMonth}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          className="h-9 w-9 items-center justify-center rounded-pill active:bg-canvas"
        >
          <ChevronRightIcon size={18} color={colors.ink} />
        </Pressable>
      </View>

      <View className="mb-1 flex-row">
        {WEEKDAY_INITIALS.map((d, i) => (
          <View key={i} className="flex-1 items-center py-1">
            <Text className="font-sans text-caption text-muted">{d}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <View key={`blank-${i}`} style={{ width: `${100 / 7}%` }} className="aspect-square" />
        ))}
        {days.map((day) => (
          <DayCell
            key={day.date.toISOString()}
            day={day}
            selected={!!selected && isSameDay(selected, day.date)}
            onPress={() => onSelect(day.date)}
          />
        ))}
      </View>

      <View className="mt-4 flex-row items-center gap-4 border-t border-hairline pt-3">
        <Legend swatch="bg-lime" label="Wave day" />
        <Legend swatch="border border-ink bg-surface" label="Rush +30%" />
      </View>
    </View>
  );
}

function DayCell({
  day,
  selected,
  onPress,
}: {
  day: CalendarDay;
  selected: boolean;
  onPress: () => void;
}) {
  const disabled = day.kind === "disabled";

  const ground = selected
    ? "bg-ink"
    : day.kind === "standard"
      ? "bg-lime"
      : day.kind === "rush"
        ? "border border-ink bg-surface"
        : "bg-surface";

  const label = selected
    ? "text-surface"
    : disabled
      ? "text-subtle"
      : "text-ink";

  return (
    <View style={{ width: `${100 / 7}%` }} className="aspect-square p-0.5">
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected }}
        accessibilityLabel={`${day.date.getDate()} ${MONTHS[day.date.getMonth()]}${
          day.kind === "rush" ? ", rush order, 30 percent more on the delivery fee" : ""
        }${day.kind === "standard" ? ", Wave day" : ""}`}
        className={`flex-1 items-center justify-center rounded-pill ${ground}`}
      >
        <Text className={`font-sans-medium text-body ${label}`}>{day.date.getDate()}</Text>
      </Pressable>
    </View>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className={`h-3.5 w-3.5 rounded-pill ${swatch}`} />
      <Text className="font-sans text-caption text-muted">{label}</Text>
    </View>
  );
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
