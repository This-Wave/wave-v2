import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useDeliveryPin } from "../../lib/orders";
import { Button } from "./Button";

const CANCELLABLE = ["confirmed", "rider_assigned", "pending", "payment_pending"];

/** Compact delivery code for tracking screens — tap to reveal full digits. */
export function DeliveryPinSnippet({
  orderId,
  orderStatus,
  onOpenFull,
}: {
  orderId: string;
  orderStatus?: string;
  onOpenFull?: () => void;
}) {
  const { data: pin, isLoading, isError, refetch } = useDeliveryPin(orderId);
  const [revealed, setRevealed] = useState(false);

  if (orderStatus && !CANCELLABLE.includes(orderStatus) && orderStatus !== "en_route" && orderStatus !== "at_checkpoint") {
    return null;
  }

  return (
    <View className="mb-6 rounded-card bg-surface p-4">
      <Text className="mb-1 font-sans-semibold text-meta text-muted">DELIVERY CODE</Text>
      {isLoading ? (
        <Text className="font-sans text-body text-muted">Loading code…</Text>
      ) : isError || !pin ? (
        <View>
          <Text className="mb-2 font-sans text-body text-muted">Couldn’t load your code.</Text>
          <Button label="Try again" variant="ghost" full={false} onPress={() => void refetch()} />
        </View>
      ) : (
        <Pressable
          onPress={() => setRevealed((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={revealed ? `Delivery code ${pin.split("").join(" ")}` : "Show delivery code"}
        >
          <Text
            className="font-sans-bold text-ink"
            style={{ fontSize: revealed ? 32 : 28, letterSpacing: revealed ? 8 : 4 }}
          >
            {revealed ? pin : "••••••"}
          </Text>
          <Text className="mt-1 font-sans text-body text-muted">
            {revealed ? "Tap to hide · read this to your runner" : "Tap to show · also sent by SMS"}
          </Text>
        </Pressable>
      )}
      {onOpenFull ? (
        <Pressable onPress={onOpenFull} className="mt-3">
          <Text className="font-sans-medium text-body text-ink">Full code screen</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
