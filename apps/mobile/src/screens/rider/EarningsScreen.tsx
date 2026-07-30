import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { WalletIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
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
  const now = new Date();

  const filtered = useMemo(() => {
    if (!earnings) return [];
    return earnings.filter((e) => {
      const created = new Date(e.createdAt);
      if (range === "today") return isSameDay(created, now);
      if (range === "week") return isSameWeek(created, now);
      return true;
    });
    // `now` is intentionally excluded — it changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnings, range]);

  const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingTotal = filtered
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "";

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 128 }}>
        <Text className="mb-4 font-sans-semibold text-[22px] tracking-tight text-ink">Earnings</Text>

        <View className="mb-5 flex-row rounded-control border border-border bg-surface p-1">
          {RANGES.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              className={`h-[38px] flex-1 items-center justify-center rounded-tile ${
                range === r.key ? "bg-wave-500" : ""
              }`}
            >
              <Text
                className={`text-[12px] ${
                  range === r.key ? "font-sans-semibold text-white" : "font-sans-medium text-muted"
                }`}
              >
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <Skeleton height={150} radius={24} />
        ) : (
          <View className="mb-6 overflow-hidden rounded-card bg-wave-500 p-[22px]" style={shadowCard}>
            <View
              className="absolute h-[180px] w-[180px] rounded-full"
              style={{ backgroundColor: "rgba(176,232,146,0.1)", top: -80, right: -60 }}
            />
            <Text className="mb-1.5 font-sans-medium text-[12px] text-white opacity-60">
              {rangeLabel} earnings
            </Text>
            <Text className="mb-1 font-sans-semibold text-[44px] leading-[44px] tracking-tight text-white">
              {formatGhs(total)}
            </Text>
            <Text className="font-sans-medium text-[12px] text-white opacity-60">
              {filtered.length} {filtered.length === 1 ? "delivery" : "deliveries"}
            </Text>
          </View>
        )}

        {isLoading ? (
          <Skeleton height={180} radius={24} />
        ) : filtered.length === 0 ? (
          <View className="pt-6">
            <EmptyState
              art={<WalletIcon size={34} color={colors.muted} strokeWidth={1.6} />}
              title="No earnings yet"
              description="Completed deliveries will show up here."
            />
          </View>
        ) : (
          <>
            <Text className="mb-3 font-sans-semibold text-[18px] text-ink">Breakdown</Text>
            <View
              className="mb-5 overflow-hidden rounded-card border border-border bg-surface"
              style={shadowCard}
            >
              {filtered.map((earning, i) => (
                <View
                  key={earning.id}
                  className={`flex-row items-center p-4 ${
                    i < filtered.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <View className="flex-1">
                    <Text className="font-sans-semibold text-[14px] text-ink">
                      {earning.order?.shop?.name ?? "Delivery"}
                    </Text>
                    <Text className="mt-0.5 text-[12px] text-muted">
                      {new Date(earning.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View className="items-end gap-1.5">
                    <Text className="font-sans-semibold text-[14px] text-wave-500">
                      +{formatGhs(Number(earning.amount))}
                    </Text>
                    <Badge
                      label={earning.status === "pending" ? "Pending" : "Paid"}
                      variant={earning.status === "pending" ? "warning" : "success"}
                    />
                  </View>
                </View>
              ))}
            </View>

            <Button
              label={`Request payout · ${formatGhs(pendingTotal)}`}
              onPress={() => {}}
              disabled={pendingTotal <= 0}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
