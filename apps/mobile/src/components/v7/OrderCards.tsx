import { Pressable, Text, View } from "react-native";
import { BoxIcon } from "../icons";
import { colors } from "../../theme/tokens";
import { Button, StatusPill } from "../v6";
import { RouteLine } from "./Signature";
import { statusPill } from "../../screens/student/orderPresenters";
import type { Order } from "../../types";

/** What a student calls the parcel: the item for a pickup, the shop otherwise. */
export function orderTitle(order: Order): string {
  if (order.orderType === "pickup") return order.itemDescription || "Your parcel";
  return order.shop?.name ?? order.itemDescription ?? "Your order";
}

/** "Kasoa → On campus" for a pickup; the shop's area otherwise. */
export function orderRoute(order: Order): string {
  const from =
    order.orderType === "pickup"
      ? (order.originCheckpoint?.name ?? "Accra").split(" & ")[0]
      : (order.shop?.locationText ?? order.shop?.name ?? "Accra");
  return `${from} → ${order.checkpoint?.name ?? "Campus"}`;
}

function shortDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}

/**
 * v7 canvas order row (Orders, Home "Recent"): parcel glyph on wash, the item,
 * the route and date, and the state in words on the right.
 */
export function OrderCardRow({ order, onPress, showDate = true }: { order: Order; onPress: () => void; showDate?: boolean }) {
  const pill = statusPill(order.status, !!order.companyId);
  const when = order.status === "delivered" ? (order.deliveredAt ?? order.scheduledDate) : null;
  const meta = [orderRoute(order), showDate && when ? shortDate(when) : null].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${orderTitle(order)}, ${meta}, ${pill.label}`}
      className="flex-row items-center rounded-card border border-hairline bg-surface px-4 py-3.5 active:bg-canvas"
      style={{ gap: 12 }}
    >
      <View className="h-11 w-11 items-center justify-center rounded-input bg-wash">
        <BoxIcon size={20} color={colors.ink} strokeWidth={1.9} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-ui text-ink" numberOfLines={1}>
          {orderTitle(order)}
        </Text>
        <Text className="font-sans text-meta text-muted" numberOfLines={2}>
          {meta}
        </Text>
      </View>
      <Text className="font-sans-bold text-meta text-ink-700">{pill.label}</Text>
    </Pressable>
  );
}

/**
 * v7 canvas Home hero: the parcel on its way, outlined in ink, with the route
 * from the sender and one Track key.
 */
export function ParcelHero({ order, onTrack }: { order: Order; onTrack: () => void }) {
  const pill = statusPill(order.status, !!order.companyId);
  return (
    <View className="rounded-card border-2 border-ink bg-surface p-4" style={{ gap: 12 }}>
      <View className="flex-row items-center justify-between">
        <StatusPill label={pill.label} tone={pill.tone} />
        <Text className="font-sans text-body text-muted" numberOfLines={1}>
          {orderTitle(order)}
        </Text>
      </View>
      <RouteLine
        fromLabel="From"
        from={
          order.orderType === "pickup"
            ? [order.senderName, order.originCheckpoint?.name?.split(" & ")[0]].filter(Boolean).join(", ") || "Accra"
            : (order.shop?.name ?? "The shop")
        }
        toLabel="To you at"
        to={order.checkpoint?.name ?? "your pickup point"}
      />
      <Button label="Track" variant="ghost" small onPress={onTrack} />
    </View>
  );
}
