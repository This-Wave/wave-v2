import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  Button,
  Chip,
  Empty,
  Gutter,
  ListError,
  ListSkeleton,
  PageTitle,
  Screen,
  ScreenBody,
} from "../../components/v6";
import { useMyOrders } from "../../lib/orders";
import { openOrderDetail, openOrderTracking } from "../../lib/desktopNavigate";
import { formatGhsCompact } from "../../lib/pricing";
import { resetToPayment } from "../../lib/navigationFlows";
import { Illustration } from "../../components/v7/Illustration";
import { OrderCardRow, orderTitle } from "../../components/v7/OrderCards";
import { StudentOrdersWeb } from "./web/StudentOrdersWeb";
import { useLayout } from "../../hooks/useLayout";

type Nav = NativeStackNavigationProp<StudentStackParamList>;

const LIVE = ["confirmed", "rider_assigned", "en_route", "at_checkpoint"];

export function OrderHistoryScreen() {
  const { isDesktop } = useLayout();
  if (isDesktop) return <StudentOrdersWeb />;
  return <OrderHistoryMobile />;
}

function OrderHistoryMobile() {
  const navigation = useNavigation<Nav>();
  const { data: orders, isLoading, isError, refetch, isRefetching } = useMyOrders();

  const live = useMemo(() => (orders ?? []).filter((o) => LIVE.includes(o.status)), [orders]);
  const unpaid = useMemo(() => (orders ?? []).filter((o) => o.status === "payment_pending"), [orders]);
  const past = useMemo(
    () => (orders ?? []).filter((o) => !LIVE.includes(o.status) && o.status !== "payment_pending"),
    [orders],
  );
  const hasActive = live.length + unpaid.length > 0;
  const [tab, setTab] = useState<"active" | "past" | null>(null);
  const shown = tab ?? (hasActive ? "active" : "past");

  const pastList = (
    <View style={{ gap: 8 }}>
      {past.map((o) => (
        <OrderCardRow key={o.id} order={o} onPress={() => openOrderDetail(navigation, o.id)} />
      ))}
    </View>
  );

  return (
    <Screen>
      <ScreenBody bottomInset={24} refreshing={isRefetching} onRefresh={() => void refetch()}>
        <Gutter className="pb-4 pt-6">
          <PageTitle>Orders</PageTitle>
        </Gutter>

        {isLoading ? (
          <Gutter>
            <ListSkeleton rows={4} />
          </Gutter>
        ) : isError ? (
          <Gutter>
            <ListError onRetry={() => void refetch()} />
          </Gutter>
        ) : (orders ?? []).length === 0 ? (
          // v7 canvas: the illustrated first-run state, one way forward.
          <Gutter className="items-center pt-6">
            <Illustration name="pillow" width={230} height={160} />
            <Text accessibilityRole="header" className="mt-4 text-center font-display text-heading text-ink">
              No orders yet
            </Text>
            <Text className="mb-5 mt-2 text-center font-sans text-body text-muted">
              Your first one shows up here.
            </Text>
            <View className="self-stretch">
              <Button label="Send a package" onPress={() => navigation.navigate("PickupRequest")} />
            </View>
          </Gutter>
        ) : (
          <>
            <Gutter className="mb-4 flex-row" style={{ gap: 8 }}>
              <Chip label="Active" selected={shown === "active"} onPress={() => setTab("active")} />
              <Chip label="Past" selected={shown === "past"} onPress={() => setTab("past")} />
            </Gutter>

            {shown === "active" ? (
              <Gutter style={{ gap: 8 }}>
                {unpaid.map((o) => (
                  <View key={o.id} className="rounded-card border border-hairline bg-surface p-4" style={{ gap: 12 }}>
                    <View className="flex-row items-center" style={{ gap: 12 }}>
                      <View className="min-w-0 flex-1">
                        <Text className="font-sans-bold text-ui text-ink" numberOfLines={1}>
                          {orderTitle(o)}
                        </Text>
                        <Text className="font-sans text-meta text-muted" numberOfLines={1}>
                          {formatGhsCompact(Number(o.totalAmount ?? 0))} · not paid yet
                        </Text>
                      </View>
                    </View>
                    <Button
                      label="Pay now"
                      onPress={() => resetToPayment(navigation, { orderId: o.id, totalAmount: Number(o.totalAmount) })}
                    />
                  </View>
                ))}
                {live.map((o) => (
                  <OrderCardRow key={o.id} order={o} onPress={() => openOrderTracking(navigation, o.id)} />
                ))}
                {!hasActive ? (
                  <Text className="py-6 text-center font-sans text-body text-muted">Nothing on the way right now.</Text>
                ) : null}
                {past.length > 0 ? (
                  <>
                    <Text className="mb-1 mt-5 font-sans-bold text-ui text-ink">Earlier</Text>
                    {pastList}
                  </>
                ) : null}
              </Gutter>
            ) : (
              <Gutter>
                {past.length === 0 ? (
                  <Empty title="Nothing finished yet" body="Collected parcels collect here." />
                ) : (
                  pastList
                )}
              </Gutter>
            )}
          </>
        )}
      </ScreenBody>
    </Screen>
  );
}
