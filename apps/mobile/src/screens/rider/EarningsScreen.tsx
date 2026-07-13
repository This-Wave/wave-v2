import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { Wallet } from "lucide-react-native";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { ListRow } from "../../components/ui/ListRow";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useRiderEarnings } from "../../lib/rider";
import { formatGhs } from "../../lib/pricing";

type RangeKey = "today" | "week" | "all";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "all", label: "All Time" },
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
  const now = new Date();

  const filtered = useMemo(() => {
    if (!earnings) return [];
    return earnings.filter((e) => {
      const created = new Date(e.createdAt);
      if (range === "today") return isSameDay(created, now);
      if (range === "week") return isSameWeek(created, now);
      return true;
    });
  }, [earnings, range]);

  const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingTotal = filtered.filter((e) => e.status === "pending").reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="px-6 pb-3 pt-2">
        <Text className="font-sans-extrabold text-[20px] tracking-tight text-ink">Earnings</Text>
      </View>

      <View className="px-6 pb-3">
        <View className="flex-row rounded-well border border-border bg-surface p-1">
          {RANGES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              className={`flex-1 items-center rounded-chip py-2 ${range === r.key ? "bg-ink" : ""}`}
            >
              <Text className={`font-sans-semibold text-[11px] ${range === r.key ? "text-white" : "text-text-tertiary"}`}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
        {isLoading ? (
          <Skeleton height={110} radius={14} />
        ) : (
          <View className="rounded-card bg-ink p-4">
            <Text className="mb-1 text-[11px] text-white opacity-70">
              {RANGES.find((r) => r.key === range)?.label} Earnings
            </Text>
            <Text className="mb-1 font-sans-extrabold text-[28px] text-white">{formatGhs(total)}</Text>
            <Text className="text-[11px] text-white opacity-70">{filtered.length} deliveries</Text>
          </View>
        )}

        {isLoading ? (
          <Skeleton height={140} radius={14} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="No earnings yet" description="Completed deliveries will show up here." />
        ) : (
          <View className="overflow-hidden rounded-well border border-border bg-surface">
            {filtered.map((earning, i) => (
              <ListRow
                key={earning.id}
                bordered={i < filtered.length - 1}
                title={earning.order?.shop?.name ?? "Delivery"}
                subtitle={new Date(earning.createdAt).toLocaleDateString()}
                trailing={
                  <View className="items-end gap-1">
                    <Text className="font-sans-bold text-[13px] text-success-text">+{formatGhs(Number(earning.amount))}</Text>
                    {earning.status === "pending" ? <Badge label="Pending" variant="warning" /> : <Badge label="Paid" variant="success" /> }
                  </View>
                }
              />
            ))}
          </View>
        )}

        {!isLoading && filtered.length > 0 ? (
          <Button label={`Request Payout · ${formatGhs(pendingTotal)}`} onPress={() => {}} disabled={pendingTotal <= 0} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
