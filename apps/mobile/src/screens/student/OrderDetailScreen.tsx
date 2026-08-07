import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  Gutter,
  Ledger,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  StatusPill,
  Steps,
  Thumb,
  TopBar,
} from "../../components/v6";
import { useOrder } from "../../lib/orders";
import { buildOrderLedger } from "../../lib/ledger";
import { currentStepIndex, orderSteps, shortOrderRef, statusPill } from "./orderPresenters";

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

  if (!order) {
    return (
      <Screen>
        <TopBar onBack={() => navigation.goBack()} />
      </Screen>
    );
  }

  const pill = statusPill(order.status);
  const ledger = buildOrderLedger(order);

  return (
    <Screen>
      <TopBar title={shortOrderRef(order.id)} onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-2">
          <StatusPill label={pill.label} tone={pill.tone} />
          <Text className="mt-3 font-sans-bold text-heading text-ink">
            {order.shop?.name ?? "Package pickup"}
          </Text>
          <Text className="mb-7 mt-1 font-sans text-body text-muted">{whenLine(order)}</Text>

          <Text className="mb-3 font-sans-medium text-subheading text-ink">What you ordered</Text>
          <RowGroup>
            <Row
              title={order.itemDescription ?? "—"}
              meta={order.checkpoint?.name ? `Delivered to ${order.checkpoint.name}` : undefined}
              leading={<Thumb uri={order.shop?.logoUrl} />}
              chevron={false}
            />
            {order.rider ? (
              <Row title={order.rider.fullName} meta="Your runner" chevron={false} />
            ) : null}
          </RowGroup>

          <Text className="mb-3 mt-7 font-sans-medium text-subheading text-ink">What it cost</Text>
          <View className="rounded-card bg-surface p-5">
            <Ledger ledger={ledger} />
          </View>

          {!ledger.reconciles ? (
            <Text className="mt-2 font-sans text-meta text-muted">
              Line-by-line breakdown unavailable for this order.
            </Text>
          ) : null}

          <Text className="mb-3 mt-7 font-sans-medium text-subheading text-ink">How it went</Text>
          <View className="rounded-card bg-surface p-5">
            <Steps steps={orderSteps(order)} currentIndex={currentStepIndex(order.status)} />
          </View>
        </Gutter>
      </ScreenBody>

      {order.shop ? (
        <ActionBar>
          <Button
            label="Order this again"
            onPress={() =>
              navigation.navigate("DescribeOrder", {
                shopId: order.shop!.id,
                shopName: order.shop!.name,
              })
            }
          />
        </ActionBar>
      ) : null}
    </Screen>
  );
}

function whenLine(order: { deliveredAt?: string | null; scheduledDate?: string }): string {
  const iso = order.deliveredAt ?? order.scheduledDate;
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  return order.deliveredAt
    ? `Delivered ${day} at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : `Scheduled for ${day}`;
}
