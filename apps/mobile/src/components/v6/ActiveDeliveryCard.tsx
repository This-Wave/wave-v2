import { Pressable, Text, View } from "react-native";
import type { Order } from "../../types";
import { statusPill } from "../../screens/student/orderPresenters";
import { StatusPill } from "./Controls";
import { CheckIcon } from "../icons";
import { colors } from "../../theme/tokens";

/** Where the order started, as a student reads it: the shop, or the checkpoint it was left at. */
function fromLabel(order: Order): string {
  if (order.orderType === "pickup") return order.originCheckpoint?.name ?? "Pickup point";
  return order.shop?.name ?? "The shop";
}

/**
 * How far along, in three stops.
 *
 * 0 = paid and waiting for a runner, 1 = a runner has it, 2 = handed over.
 * The middle stop is where an order spends most of its life, which is why it
 * carries the status label rather than the ends.
 */
function stopReached(order: Order): number {
  switch (order.status) {
    case "delivered":
      return 2;
    case "en_route":
    case "at_checkpoint":
      return 1;
    default:
      return 0;
  }
}

/**
 * One order in flight: what it is, where it is going, and how far it has got.
 *
 * Replaces the floating bar that used to follow students between tabs. A card
 * in the list can say the route and the stage — which is what someone actually
 * wants to know — where a one-line bar could only say the status, and covered
 * the last row of every screen it floated over.
 */
export function ActiveDeliveryCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const pill = statusPill(order.status);
  const reached = stopReached(order);
  const to = order.checkpoint?.name ?? "your checkpoint";
  const from = fromLabel(order);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${order.orderType === "pickup" ? "Pickup" : order.shop?.name ?? "Order"}, ${pill.label}, from ${from} to ${to}. Open it.`}
      className="rounded-card bg-surface p-4 active:bg-hairline"
    >
      <View className="mb-4 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-medium text-ui text-ink" numberOfLines={1}>
            {order.orderType === "pickup" ? "Package pickup" : (order.shop?.name ?? "Your order")}
          </Text>
          <Text className="font-sans text-meta text-muted" numberOfLines={1}>
            {/* The tail of the id: enough to match a rider's screen, short
                enough to read out loud. */}
            No. {order.id.slice(-6).toUpperCase()}
          </Text>
        </View>
        <StatusPill label={pill.label} tone={pill.tone} />
      </View>

      {/* Three stops, ink for reached and hairline for not. The rail is the
          only thing carrying position, so the label above says it too. */}
      <View className="flex-row items-center">
        {[0, 1, 2].map((stop) => {
          const done = stop <= reached;
          return (
            <View key={stop} className="flex-row items-center" style={stop === 2 ? undefined : { flex: 1 }}>
              <View
                className={`h-5 w-5 items-center justify-center rounded-pill ${done ? "bg-ink" : "border border-hairline bg-surface"}`}
              >
                {done && stop < reached ? (
                  <CheckIcon size={12} color={colors.white} strokeWidth={2.4} />
                ) : done ? (
                  <View className="h-2 w-2 rounded-pill bg-lime" />
                ) : null}
              </View>
              {stop === 2 ? null : (
                <View className={`h-0.5 flex-1 ${stop < reached ? "bg-ink" : "bg-hairline"}`} />
              )}
            </View>
          );
        })}
      </View>

      <View className="mt-2 flex-row items-center justify-between gap-3">
        <Text className="flex-1 font-sans text-meta text-muted" numberOfLines={1}>
          {from}
        </Text>
        <Text className="flex-1 text-right font-sans text-meta text-muted" numberOfLines={1}>
          {to}
        </Text>
      </View>
    </Pressable>
  );
}
