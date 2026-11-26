import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  Gutter,
  Ledger,
  Screen,
  ScreenBody,
  StatusPill,
  TopBar,
} from "../../components/v6";
import { RouteLine, Tracker } from "../../components/v7/Signature";
import { orderTitle } from "../../components/v7/OrderCards";
import { openSupportContact } from "../../lib/support";
import { formatGhs } from "../../lib/pricing";
import { useOrder } from "../../lib/orders";
import { buildOrderLedger } from "../../lib/ledger";
import { statusPill, trackerSteps } from "./orderPresenters";
import { describeWave } from "../../lib/wave";
import { isStandardRunDay } from "../../lib/pricing";
import { resetToShopMenu } from "../../lib/navigationFlows";

type Route = RouteProp<StudentStackParamList, "OrderDetail">;

/**
 * A finished order's record. Tracking answers "where is it"; this answers "what
 * did I get and what did it cost".
 *
 * The cost block goes through `buildOrderLedger`, which is the fix for the v5
 * defect where `discountApplied` — a **percentage** — was printed through a
 * currency formatter. A 20% loyalty discount on a GH₵5 fee showed as
 * "−GH₵20.00" and the breakdown could not be reconciled with the total. See
 * `lib/ledger.ts`.
 */
export function OrderDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);

  // Reordering books onto the next open Wave; the calendar is how you pick a
  // different one. Computed before the early return so hook order stays stable.
  const nextWaveDate = useMemo(() => {
    const next = describeWave();
    const date = next?.date ?? new Date();
    return { scheduledDate: date.toISOString(), isSpecialOrder: !isStandardRunDay(date) };
  }, []);

  if (!order) {
    return (
      <Screen narrow>
        <TopBar onBack={() => navigation.goBack()} />
      </Screen>
    );
  }

  const pill = statusPill(order.status, !!order.companyId);
  const ledger = buildOrderLedger(order);

  const size = order.packageSize ? `${order.packageSize[0]!.toUpperCase()}${order.packageSize.slice(1)} size` : null;

  return (
    <Screen>
      <TopBar title="Order" onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-1">
          <StatusPill label={pill.label} tone={pill.tone} />
          <Text accessibilityRole="header" className="mt-3 font-display text-heading text-ink">
            {orderTitle(order)}
          </Text>
          <Text className="mb-5 mt-1 font-sans text-body text-muted">
            {[shortDay(order.deliveredAt ?? order.scheduledDate), size].filter(Boolean).join(" · ")}
          </Text>

          <View className="mb-4 rounded-card border border-hairline bg-surface p-4">
            <RouteLine
              fromLabel={order.orderType === "pickup" ? "From" : "Bought at"}
              from={
                order.orderType === "pickup"
                  ? [order.senderName, order.originCheckpoint?.name?.split(" & ")[0]].filter(Boolean).join(", ") || "Accra"
                  : (order.shop?.name ?? "The shop")
              }
              toLabel="To you at"
              to={order.checkpoint?.name ?? "your pickup point"}
              progress={order.status === "delivered" ? 1 : undefined}
            />
          </View>

          <View className="mb-5 rounded-card border border-hairline bg-surface p-4">
            <Tracker steps={trackerSteps(order)} />
          </View>

          {ledger.reconciles && order.orderType !== "pickup" ? (
            <View className="mb-2">
              <Ledger ledger={ledger} />
            </View>
          ) : (
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-ui text-muted">{order.paidAt ? "Paid" : "Total"}</Text>
              <Text className="font-sans-bold text-ui text-ink">{formatGhs(Number(order.totalAmount ?? 0))}</Text>
            </View>
          )}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View style={{ gap: 4 }}>
          {order.orderType === "pickup" ? (
            <Button
              label="Send again"
              onPress={() =>
                navigation.navigate("PickupRequest", {
                  ...nextWaveDate,
                  fromId: order.originCheckpointId ?? undefined,
                  toId: order.checkpointId ?? undefined,
                  description: order.itemDescription ?? undefined,
                })
              }
            />
          ) : order.shop ? (
            <Button
              label="Order again"
              onPress={() =>
                resetToShopMenu(navigation, {
                  shopId: order.shop!.id,
                  shopName: order.shop!.name,
                  scheduledDate: nextWaveDate.scheduledDate,
                  isSpecialOrder: nextWaveDate.isSpecialOrder,
                })
              }
            />
          ) : null}
          <Pressable
            onPress={() => void openSupportContact()}
            accessibilityRole="link"
            className="min-h-[44px] items-center justify-center"
          >
            <Text className="font-sans-bold text-ui text-link">Get help with this order</Text>
          </Pressable>
        </View>
      </ActionBar>
    </Screen>
  );
}

function shortDay(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}
