import { useMemo } from "react";
import { Text, View } from "react-native";
import { Empty, Gutter, PageTitle, Screen, ScreenBody, Skeleton } from "../../components/v6";
import { BoxIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useRiderEarnings } from "../../lib/rider";
import { formatGhsCompact } from "../../lib/pricing";
import type { RiderEarning } from "../../types";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday 00:00 of the week `d` falls in. */
function weekStart(d: Date): Date {
  const s = new Date(d);
  const back = (s.getDay() + 6) % 7; // Monday = 0
  s.setDate(s.getDate() - back);
  s.setHours(0, 0, 0, 0);
  return s;
}

/**
 * v7 canvas "Earnings": this week's total as the figure, a bar per day (today
 * in lime), paid vs pending, then each job. Amounts are what the rider earned,
 * straight from their earning rows.
 */
export function EarningsScreen() {
  const { data: earnings, isLoading } = useRiderEarnings();

  const { week, bars, paid, pending, todayIdx } = useMemo(() => {
    const now = new Date();
    const start = weekStart(now);
    const list = (earnings ?? []).filter((e) => new Date(e.createdAt) >= start);
    const perDay = [0, 0, 0, 0, 0, 0, 0];
    for (const e of list) perDay[(new Date(e.createdAt).getDay() + 6) % 7]! += Number(e.amount);
    const sum = (rows: RiderEarning[]) => rows.reduce((t, e) => t + Number(e.amount), 0);
    return {
      week: sum(list),
      bars: perDay,
      paid: sum((earnings ?? []).filter((e) => e.status === "paid")),
      pending: sum((earnings ?? []).filter((e) => e.status === "pending")),
      todayIdx: (now.getDay() + 6) % 7,
    };
  }, [earnings]);
  const max = Math.max(...bars, 1);

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-4 pt-6">
          <PageTitle>Earnings</PageTitle>
        </Gutter>

        <Gutter style={{ gap: 12 }}>
          {isLoading ? (
            <Skeleton height={220} radius={16} />
          ) : (
            <View className="rounded-card border border-hairline bg-surface p-4">
              <Text className="font-sans text-body text-muted">This week</Text>
              <Text className="mt-1 font-display text-ink" style={{ fontSize: 44, lineHeight: 48 }}>
                {formatGhsCompact(week)}
              </Text>
              <View
                className="mt-4 flex-row items-end"
                style={{ gap: 8, height: 96 }}
                accessible
                accessibilityLabel={`By day: ${bars.map((b, i) => `${DAYS[i]} ${formatGhsCompact(b)}`).join(", ")}`}
              >
                {bars.map((b, i) => (
                  <View key={i} className="flex-1 items-center justify-end" style={{ height: 96 }}>
                    <View
                      className={`w-full rounded-input ${i === todayIdx ? "bg-lime" : "bg-wash"}`}
                      style={{ height: Math.max(8, (b / max) * 88) }}
                    />
                  </View>
                ))}
              </View>
              <View className="mt-2 flex-row" style={{ gap: 8 }}>
                {DAYS.map((d, i) => (
                  <Text key={i} className="flex-1 text-center font-sans text-caption text-muted">
                    {d}
                  </Text>
                ))}
              </View>
            </View>
          )}

          <View className="flex-row" style={{ gap: 12 }}>
            <View className="flex-1 rounded-card border border-hairline bg-surface p-4">
              <Text className="font-sans text-body text-muted">Paid</Text>
              <Text className="mt-1 font-display text-heading-sm text-ink">{formatGhsCompact(paid)}</Text>
            </View>
            <View className="flex-1 rounded-card border border-hairline bg-surface p-4">
              <Text className="font-sans text-body text-muted">Pending</Text>
              <Text className="mt-1 font-display text-heading-sm text-ink">{formatGhsCompact(pending)}</Text>
            </View>
          </View>

          {!isLoading && (earnings ?? []).length === 0 ? (
            <Empty title="Nothing yet" body="Each delivery you finish lands here." />
          ) : (
            (earnings ?? []).slice(0, 30).map((e) => (
              <View
                key={e.id}
                className="flex-row items-center rounded-card border border-hairline bg-surface px-4 py-3.5"
                style={{ gap: 12 }}
              >
                <View className="h-11 w-11 items-center justify-center rounded-input bg-wash">
                  <BoxIcon size={20} color={colors.ink} strokeWidth={1.9} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-sans-bold text-ui text-ink" numberOfLines={1}>
                    {e.order?.shop?.name ?? "Pickup"}
                  </Text>
                  <Text className="font-sans text-meta text-muted">
                    {new Date(e.createdAt).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
                    {e.status === "pending" ? " · pending" : ""}
                  </Text>
                </View>
                <Text className="font-sans-bold text-meta text-ink-700">{formatGhsCompact(Number(e.amount))}</Text>
              </View>
            ))
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
