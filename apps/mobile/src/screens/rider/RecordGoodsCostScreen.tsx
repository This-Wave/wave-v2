import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  ActionBar,
  Button,
  Field,
  Gutter,
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { useOrder } from "../../lib/orders";
import { useRecordGoodsCost } from "../../lib/rider";
import { formatGhs } from "../../lib/pricing";
import { apiErrorMessage } from "../../lib/apiError";

type Route = RouteProp<RiderStackParamList, "RecordGoodsCost">;

/**
 * What did it actually cost?
 *
 * A `shop_pickup` buys from a shop with no menu on Wave, so nobody — not the
 * student, not the server — knows the price until the runner is at the till.
 * This screen is where that number enters the system, and the student is
 * charged for exactly what is typed here.
 *
 * Two decisions that make it harder to get wrong:
 *  - **Price per unit, not per line.** The rider reads a shelf price and types
 *    it; the multiplication is the server's job. Asking someone to compute
 *    "3 × 4.50" on a phone in a shop is where a wrong charge is born.
 *  - **Every line is required.** A blank is not treated as zero. Zero is a
 *    real answer (the shop threw it in) and has to be typed deliberately.
 */
export function RecordGoodsCostScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const record = useRecordGoodsCost();

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // `?? []` would mint a new array every render, so the total below would
  // recompute on each keystroke of an unrelated field.
  const items = useMemo(() => order?.items ?? [], [order?.items]);

  const allFilled = items.length > 0 && items.every((i) => isValidAmount(prices[i.id]));

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const unit = Number(prices[item.id]);
        return sum + (Number.isFinite(unit) ? unit * item.quantity : 0);
      }, 0),
    [items, prices],
  );

  async function handleSubmit() {
    setError(null);
    try {
      await record.mutateAsync({
        orderId: params.orderId,
        lines: items.map((item) => ({
          itemId: item.id,
          actualUnitPrice: Number(prices[item.id]),
        })),
      });
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save that. Check your connection and try again."));
    }
  }

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text className="mb-2 font-sans-bold text-heading text-ink">What did you pay?</Text>
          <Text className="mb-8 font-sans text-body text-muted">
            Enter the price of ONE of each item — we'll do the multiplication. The student pays this
            before you hand anything over, so get it right the first time: it can't be changed.
          </Text>

          <View className="gap-3">
            {items.map((item) => (
              <View key={item.id} className="rounded-card bg-surface p-4">
                <Text className="mb-1 font-sans-medium text-body text-ink">{item.name}</Text>
                <Text className="mb-3 font-sans text-caption text-muted">
                  Quantity: {item.quantity}
                </Text>
                <Field
                  label="Price each (GH₵)"
                  value={prices[item.id] ?? ""}
                  onChangeText={(text) =>
                    setPrices((prev) => ({ ...prev, [item.id]: sanitizeAmount(text) }))
                  }
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  hint={
                    isValidAmount(prices[item.id]) && item.quantity > 1
                      ? `${item.quantity} × ${formatGhs(Number(prices[item.id]))} = ${formatGhs(
                          Number(prices[item.id]) * item.quantity,
                        )}`
                      : undefined
                  }
                />
              </View>
            ))}
          </View>

          <View className="mt-6 rounded-card bg-surface p-5">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans-medium text-ui text-ink">Total for the goods</Text>
              <Text className="font-sans-bold text-heading-sm text-ink">{formatGhs(total)}</Text>
            </View>
            <Text className="mt-2 font-sans text-body text-muted">
              The delivery fee was already paid when the order was placed. This is the shopping
              only.
            </Text>
          </View>

          {error ? <Text className="mt-4 font-sans text-body text-danger">{error}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Send to the student"
          onPress={handleSubmit}
          loading={record.isPending}
          disabled={!allFilled}
        />
      </ActionBar>
    </Screen>
  );
}

/** Digits and at most one decimal point, at most two decimal places. */
function sanitizeAmount(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

function isValidAmount(value: string | undefined): boolean {
  if (value === undefined || value.trim() === "" || value === ".") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}
