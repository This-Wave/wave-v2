import { Pressable, Text, View } from "react-native";
import { ChevronRightIcon } from "../icons";
import { colors } from "../../theme/tokens";
import type { Order } from "../../types";

/**
 * The way back into an order that was left at the payment step.
 *
 * A `payment_pending` order is one a student built — picked a shop, chose items,
 * named a checkpoint — and then bounced off Paystack without finishing. Home's
 * live-order filter deliberately lists only `confirmed` onward, so until now
 * that order appeared nowhere at all: not on Home, not as anything actionable in
 * Orders. The student's own work was invisible to them, and the only route back
 * was to build the basket again from scratch.
 *
 * Zeigarnik's point is that the unfinished task is the one people are already
 * carrying. This gives that feeling somewhere to land instead of making them
 * start over.
 *
 * Deliberately *not* the lime CTA treatment. This is a loose end to tidy, not
 * the thing we want a student to do most on this screen — the accent stays with
 * placing a new order.
 */
export function ResumeOrderCard({
  order,
  onPress,
}: {
  order: Order;
  onPress: () => void;
}) {
  const where = order.shop?.name ?? "Your order";
  const amount = `GH₵${Number(order.totalAmount).toFixed(2)}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // Four Texts and a chevron; without an explicit name a screen reader
      // reads them as unrelated stops and "Finish paying" belongs to nothing.
      accessible
      accessibilityLabel={`Finish paying for your order from ${where}, ${amount}`}
      accessibilityHint="Reopens the payment step for this order"
      className="mb-6 flex-row items-center gap-4 rounded-card border border-ink bg-surface p-4 active:bg-hairline"
    >
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-ui text-ink">Finish paying</Text>
        <Text className="mt-0.5 font-sans text-body text-muted" numberOfLines={1}>
          {where} · {amount}
        </Text>
      </View>
      <ChevronRightIcon size={18} color={colors.icon} strokeWidth={2} />
    </Pressable>
  );
}
