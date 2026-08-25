import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, CheckoutProgress, Gutter, Screen, ScreenBody, TopBar, WaveContextBanner } from "../../components/v6";
import { PaystackCheckout, type CheckoutOutcome } from "../../components/PaystackCheckout";
import { CardIcon, CheckIcon, MobileIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useInitiatePayment, waitForPayment, paymentInitiateErrorMessage } from "../../lib/payments";
import { webAppOrigin } from "../../lib/paymentReturn";
import { useAuthStore } from "../../store/authStore";
import { useOrder } from "../../lib/orders";
import { formatGhs, formatGhsCompact } from "../../lib/pricing";
import { exitPaymentToOrders, resetAfterPaymentOutcome } from "../../lib/navigationFlows";
import { showToast } from "../../store/toastStore";

type Route = RouteProp<StudentStackParamList, "Payment">;
type Method = "momo" | "card";

/**
 * Checkout, as an explicit state machine.
 *
 *   choosing → checkout → confirming → (OrderConfirmed | PaymentFailed)
 *
 * **The bug this replaces.** The old flow was one straight line: open the
 * browser, `await` it, then poll five times over ~7 seconds. That `await` only
 * blocks on native. On Expo Web `openBrowserAsync` resolves the instant the tab
 * opens, so the poll ran while the student was still on the Paystack page, and
 * the app announced "We couldn't confirm that" a few seconds after checkout
 * appeared — before they had entered anything.
 *
 * The fix is not a longer timer. It is knowing which state we are in:
 *
 *  - **checkout** — the student is at Paystack. We wait. We do not judge, and
 *    there is no time limit, because there is nothing to be impatient about.
 *  - **confirming** — checkout genuinely finished. Only now does the wait for
 *    the webhook begin, and only from here can it be reported as unconfirmed.
 *
 * Polling runs during BOTH states. That is what lets a web student, whose tab we
 * cannot observe, be carried straight to confirmation the moment their money
 * lands — no button, no guessing.
 *
 * Nothing here decides whether payment succeeded. Checkout closing means the
 * student is back, not that they paid; only the signed Paystack webhook confirms
 * an order.
 */
type Phase = "choosing" | "checkout" | "confirming";

export function PaymentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const profile = useAuthStore((s) => s.profile);
  const initiatePayment = useInitiatePayment();
  const { data: order } = useOrder(params.orderId);

  const [method, setMethod] = useState<Method>("momo");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("choosing");
  const [checkout, setCheckout] = useState<{ url: string; reference: string } | null>(null);

  // Cancelled when the screen unmounts so a poll can't navigate a screen the
  // student has already left.
  const cancel = useRef({ cancelled: false });
  useEffect(() => {
    const signal = cancel.current;
    return () => {
      signal.cancelled = true;
    };
  }, []);

  /**
   * Watches for the money landing, for as long as the student is on this screen.
   *
   * Runs from the moment checkout opens rather than after it closes, because on
   * web we cannot see the other tab: this poll is the only way that student ever
   * reaches confirmation. It never routes to failure — only the explicit
   * `confirming` phase below is allowed to conclude anything negative.
   */
  useEffect(() => {
    if (!checkout || phase === "choosing") return;
    let stopped = false;

    (async () => {
      const status = await waitForPayment(checkout.reference, {
        attempts: 240, // ~6 minutes at 1.5s
        signal: cancel.current,
      });
      if (stopped || cancel.current.cancelled) return;
      if (status) {
        resetAfterPaymentOutcome(navigation, {
          name: "OrderConfirmed",
          params: { orderId: params.orderId },
        });
      }
    })();

    return () => {
      stopped = true;
    };
  }, [checkout, phase, navigation, params.orderId]);

  async function handlePay() {
    setError(null);
    try {
      const { reference, payment_url: url } = await initiatePayment.mutateAsync({
        orderId: params.orderId,
        method,
        returnOrigin: webAppOrigin(),
      });
      setCheckout({ url, reference });
      setPhase("checkout");
    } catch (err) {
      setError(paymentInitiateErrorMessage(err));
    }
  }

  /**
   * Checkout finished or was dismissed.
   *
   * Either way we move to `confirming` rather than straight to failure: a
   * student who backed out of an embedded checkout may still have completed a
   * MoMo prompt on their phone, and the webhook can arrive seconds later.
   */
  async function handleCheckoutOutcome(outcome: CheckoutOutcome) {
    if (!checkout) return;
    setPhase("confirming");

    const status = await waitForPayment(checkout.reference, {
      // Generous when we know they finished; brief when they backed out, since
      // in that case we are only catching a payment already in flight.
      attempts: outcome === "completed" ? 40 : 8,
      signal: cancel.current,
    });
    if (cancel.current.cancelled) return;

    if (status) {
      resetAfterPaymentOutcome(navigation, {
        name: "OrderConfirmed",
        params: { orderId: params.orderId },
      });
    } else {
      resetAfterPaymentOutcome(navigation, {
        name: "PaymentFailed",
        params: {
          orderId: params.orderId,
          totalAmount: params.totalAmount,
        },
      });
    }
  }

  if (phase === "checkout" && checkout) {
    return (
      <Screen narrow>
        <PaystackCheckout
          paymentUrl={checkout.url}
          pending={{
            orderId: params.orderId,
            reference: checkout.reference,
            totalAmount: params.totalAmount,
          }}
          onOutcome={handleCheckoutOutcome}
        />
      </Screen>
    );
  }

  if (phase === "confirming") {
    return (
      <Screen narrow>
        <ScreenBody bottomInset={16}>
          <Gutter className="pt-16 items-center">
            <ActivityIndicator color={colors.ink} />
            <Text className="mb-2 mt-6 text-center font-sans-bold text-heading text-ink">
              Confirming your payment
            </Text>
            <Text className="text-center font-sans text-body text-muted">
              This takes a few seconds. Don't pay again — if your money left, this will finish on
              its own.
            </Text>
          </Gutter>
        </ScreenBody>
      </Screen>
    );
  }

  return (
    <Screen narrow>
      <TopBar
        onBack={() => {
          showToast("Order saved — pay anytime from Orders.");
          exitPaymentToOrders(navigation);
        }}
      />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <CheckoutProgress step={3} />
          {order ? (
            <WaveContextBanner
              scheduledDate={order.scheduledDate}
              checkpointName={order.checkpoint?.name}
              isSpecialOrder={order.isSpecialOrder}
            />
          ) : null}
          <Text className="font-sans text-body text-muted">You're paying</Text>
          <Text
            className="mb-10 mt-1 font-sans-bold text-ink"
            style={{ fontSize: 48, lineHeight: 52 }}
          >
            {formatGhsCompact(params.totalAmount)}
          </Text>

          <Text className="mb-3 font-sans-medium text-subheading text-ink">How?</Text>
          <View className="gap-2">
            <MethodRow
              label="Mobile Money"
              meta={profile?.phone ?? "MTN · Telecel · AirtelTigo"}
              icon={<MobileIcon size={20} color={colors.ink} strokeWidth={1.7} />}
              selected={method === "momo"}
              onPress={() => setMethod("momo")}
            />
            <MethodRow
              label="Card"
              meta="Visa or Mastercard"
              icon={<CardIcon size={20} color={colors.ink} strokeWidth={1.7} />}
              selected={method === "card"}
              onPress={() => setMethod("card")}
            />
          </View>

          <Text className="mt-6 font-sans text-body text-muted">
            Paystack handles the payment. You’ll stay in this tab and come straight back when
            you’re done.
          </Text>
          {error ? <Text className="mt-4 font-sans text-body text-danger">{error}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label={`Pay ${formatGhs(params.totalAmount)}`}
          onPress={handlePay}
          disabled={initiatePayment.isPending}
          loading={initiatePayment.isPending}
        />
      </ActionBar>
    </Screen>
  );
}

function MethodRow({
  label,
  meta,
  icon,
  selected,
  onPress,
}: {
  label: string;
  meta: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-3 rounded-card p-4 ${
        selected ? "bg-lime-faint" : "bg-surface"
      }`}
    >
      {icon}
      <View className="flex-1">
        <Text className="font-sans-medium text-body text-ink">{label}</Text>
        <Text className="font-sans text-body text-muted">{meta}</Text>
      </View>
      {selected ? <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}
