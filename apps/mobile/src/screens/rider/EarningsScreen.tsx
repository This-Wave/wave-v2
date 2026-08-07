import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  Chip,
  Empty,
  Gutter,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Skeleton,
  StatusPill,
} from "../../components/v6";
import { useRiderEarnings } from "../../lib/rider";
import { formatGhs } from "../../lib/pricing";

type RangeKey = "today" | "week" | "all";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "all", label: "All time" },
];

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function isSameWeek(a: Date, b: Date) {
  const start = new Date(b);
  start.setDate(b.getDate() - b.getDay());
  start.setHours(0, 0, 0, 0);
  return a.getTime() >= start.getTime();
}

export function EarningsScreen() {
  const [range, setRange] = useState<RangeKey>("today");
  const { data: earnings, isLoading } = useRiderEarnings();

  const filtered = useMemo(() => {
    if (!earnings) return [];
    // Read the clock inside the memo: a `now` computed during render is a new
    // object every pass, so listing it as a dependency would recompute on every
    // render and omitting it left the dependency list dishonest.
    const now = new Date();
    return earnings.filter((e) => {
      const created = new Date(e.createdAt);
      if (range === "today") return isSameDay(created, now);
      if (range === "week") return isSameWeek(created, now);
      return true;
    });
  }, [earnings, range]);

  const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingTotal = filtered
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-6 pt-4">
          <PageTitle>Earnings</PageTitle>
        </Gutter>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
          className="mb-6 grow-0"
        >
          {RANGES.map((r) => (
            <Chip
              key={r.key}
              label={r.label}
              selected={range === r.key}
              onPress={() => setRange(r.key)}
            />
          ))}
        </ScrollView>

        <Gutter className="mb-8">
          {isLoading ? (
            <Skeleton height={80} radius={12} />
          ) : (
            <View>
              <Text className="font-sans text-body text-muted">
                {RANGES.find((r) => r.key === range)?.label}
              </Text>
              <Text
                className="mt-1 font-sans-bold text-ink"
                style={{ fontSize: 44, lineHeight: 48 }}
              >
                {formatGhs(total)}
              </Text>
              <Text className="mt-1 font-sans text-body text-muted">
                {filtered.length} {filtered.length === 1 ? "delivery" : "deliveries"}
              </Text>
            </View>
          )}
        </Gutter>

        <Gutter>
          {isLoading ? (
            <View className="gap-2">
              <Skeleton height={64} radius={12} />
              <Skeleton height={64} radius={12} />
            </View>
          ) : filtered.length === 0 ? (
            <Empty
              title="Nothing yet"
              body="Completed deliveries show up here as soon as they're closed."
            />
          ) : (
            <RowGroup>
              {filtered.map((earning) => (
                <Row
                  key={earning.id}
                  title={earning.order?.shop?.name ?? "Delivery"}
                  meta={new Date(earning.createdAt).toLocaleDateString([], {
                    day: "numeric",
                    month: "short",
                  })}
                  chevron={false}
                  trailing={
                    <View className="items-end gap-1">
                      <Text className="font-sans-semibold text-body text-ink">
                        +{formatGhs(Number(earning.amount))}
                      </Text>
                      <StatusPill
                        label={earning.status === "pending" ? "Pending" : "Paid"}
                        tone={earning.status === "pending" ? "neutral" : "done"}
                      />
                    </View>
                  }
                />
              ))}
            </RowGroup>
          )}

          {/*
            The "Request Payout" button was removed rather than wired. There is
            no payout endpoint, no payout model, and no record of a rider's
            payment details anywhere in the schema — so it could only ever have
            done nothing, and a rider tapping it would reasonably assume their
            money was on its way. What is true is stated instead.
          */}
          {!isLoading && pendingTotal > 0 ? (
            <View className="mt-6 rounded-card bg-surface p-5">
              <Text className="mb-1 font-sans-semibold text-meta text-muted">AWAITING PAYOUT</Text>
              <Text className="font-sans text-body text-ink">
                {formatGhs(pendingTotal)} is settled by the Wave team directly. There's nothing to
                request here.
              </Text>
            </View>
          ) : null}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
