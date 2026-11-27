import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  Chip,
  CodeInput,
  Gutter,
  PhoneField,
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { PaystackCheckout, type CheckoutOutcome } from "../../components/PaystackCheckout";
import { CardIcon, CheckIcon, MobileIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useInitiatePayment, waitForPayment, paymentInitiateErrorMessage } from "../../lib/payments";
import { webAppOrigin } from "../../lib/paymentReturn";
import { useAuthStore } from "../../store/authStore";
import { useOrder } from "../../lib/orders";
import { formatGhs } from "../../lib/pricing";
import { exitPaymentToOrders, resetAfterPaymentOutcome } from "../../lib/navigationFlows";
import { showToast } from "../../store/toastStore";
import {
  guessMomoNetwork,
  maskMomoNumber,
  momoErrorCode,
  MOMO_NETWORKS,
  pendingPromptReference,
  usePaymentOptions,
  useSubmitMomoCode,
  type MomoNetwork,
} from "../../lib/momo";
import { MomoApprove } from "../../components/MomoApprove";

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
type Phase = "choosing" | "checkout" | "confirming" | "otp" | "approve";

/**
 * How long the approve screen waits for the MoMo prompt before saying the
 * payment was not confirmed. A prompt left on a phone expires well inside this.
 */
const APPROVE_WAIT_ATTEMPTS = 120; // ~3 minutes at 1.5s

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

  // Moolre MoMo: the number and network the prompt goes to. Prefilled from the
  // profile, network guessed from the prefix; both editable (ported numbers).
  const { data: options } = usePaymentOptions();
  const moolreMomo = options?.momo.provider === "moolre";
  const cardEnabled = options?.card ?? true;
  const profileDigits = (profile?.phone ?? "").replace(/^\+?233/, "").replace(/\D/g, "");
  const [momoDigits, setMomoDigits] = useState(profileDigits);
  const [network, setNetwork] = useState<MomoNetwork | null>(guessMomoNetwork(profileDigits));
  const [networkTouched, setNetworkTouched] = useState(false);
  const [momo, setMomo] = useState<{ reference: string; payer: string; network: MomoNetwork } | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const submitCode = useSubmitMomoCode();
  const [promptUnconfirmed, setPromptUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);

  function changeMomoDigits(next: string) {
    setMomoDigits(next);
    // Follow the number until the student picks a network themselves.
    if (!networkTouched) setNetwork(guessMomoNetwork(next));
  }

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
    if (!checkout || (phase !== "checkout" && phase !== "confirming")) return;
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

  /**
   * The approve screen: the prompt is on the phone and the poll decides.
   * Confirmation goes ahead the moment the money lands; only after the full
   * wait does it conclude "not confirmed", and even then the order is saved.
   */
  useEffect(() => {
    if (phase !== "approve" || !momo) return;
    let stopped = false;
    (async () => {
      let declined = false;
      const status = await waitForPayment(momo.reference, {
        attempts: APPROVE_WAIT_ATTEMPTS,
        signal: cancel.current,
        onDecline: () => {
          declined = true;
        },
      });
      if (stopped || cancel.current.cancelled) return;
      // The network refused the charge (low balance, wallet limit, not allowed):
      // no prompt is coming, so say so now rather than after the full wait.
      if (declined) {
        setError(
          "Your Mobile Money payment was declined. Check your balance and wallet limit, or pay another way.",
        );
        setMomo(null);
        setPhase("choosing");
        return;
      }
      resetAfterPaymentOutcome(
        navigation,
        status
          ? { name: "OrderConfirmed", params: { orderId: params.orderId } }
          : { name: "PaymentFailed", params: { orderId: params.orderId, totalAmount: params.totalAmount } },
      );
    })();
    return () => {
      stopped = true;
    };
  }, [phase, momo, navigation, params.orderId, params.totalAmount]);

  async function handlePay() {
    setError(null);
    const usingMoolre = method === "momo" && moolreMomo;
    if (usingMoolre) {
      if (momoDigits.length !== 9) {
        setError("Enter your Mobile Money number, like 24 123 4521.");
        return;
      }
      if (!network) {
        setError("Pick your Mobile Money network.");
        return;
      }
    }
    try {
      const result = await initiatePayment.mutateAsync({
        orderId: params.orderId,
        method,
        returnOrigin: webAppOrigin(),
        ...(usingMoolre ? { payerPhone: `0${momoDigits}`, network: network ?? undefined } : {}),
      });
      if (result.provider === "moolre") {
        setMomo({ reference: result.reference, payer: result.payer, network: result.network });
        setCode("");
        setCodeError(null);
        setPromptUnconfirmed(result.prompt === "unconfirmed");
        setResendNote(null);
        setPhase(result.next === "otp" ? "otp" : "approve");
        return;
      }
      setCheckout({ url: result.payment_url, reference: result.reference });
      setPhase("checkout");
    } catch (err) {
      // A prompt sent a moment ago is still live: wait on that one rather
      // than send a second (two live prompts is how a student pays twice).
      const pending = pendingPromptReference(err);
      if (pending && usingMoolre && network) {
        setMomo({ reference: pending, payer: `0${momoDigits}`, network });
        setPromptUnconfirmed(false);
        setPhase("approve");
        return;
      }
      setError(paymentInitiateErrorMessage(err));
    }
  }

  async function handleSubmitCode() {
    if (!momo || code.length !== 6) return;
    setCodeError(null);
    try {
      const result = await submitCode.mutateAsync({ reference: momo.reference, code });
      if (result.next === "otp") {
        setCode("");
        setCodeError("That code has expired. We've sent a new one.");
        return;
      }
      setPromptUnconfirmed(result.prompt === "unconfirmed");
      setResendNote(null);
      setPhase("approve");
    } catch (err) {
      setCode("");
      setCodeError(
        momoErrorCode(err) === "otp_wrong"
          ? "That code is not right. Check the SMS and try again."
          : paymentInitiateErrorMessage(err),
      );
    }
  }

  /**
   * "Send it again" from the approve screen. The API refuses while a prompt
   * from the last two minutes may still be live (two live prompts is how a
   * student pays twice), so this is safe to offer.
   */
  async function handleResend() {
    if (!momo || resending) return;
    setResending(true);
    setResendNote(null);
    try {
      const result = await initiatePayment.mutateAsync({
        orderId: params.orderId,
        method: "momo",
        returnOrigin: webAppOrigin(),
        payerPhone: momo.payer,
        network: momo.network,
      });
      if (result.provider === "moolre") {
        setMomo({ reference: result.reference, payer: result.payer, network: result.network });
        setPromptUnconfirmed(result.prompt === "unconfirmed");
        if (result.next === "otp") {
          setCode("");
          setCodeError(null);
          setPhase("otp");
        }
      }
    } catch (err) {
      setResendNote(
        pendingPromptReference(err)
          ? "A request is already on your phone. Approve it, or try again in a minute."
          : paymentInitiateErrorMessage(err),
      );
    } finally {
      setResending(false);
    }
  }

  function backToChoosing() {
    setMomo(null);
    setPhase("choosing");
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

  const sizeLabel = order?.packageSize
    ? `${order.packageSize[0]!.toUpperCase()}${order.packageSize.slice(1)} size`
    : null;

  if (phase === "approve" && momo) {
    return (
      <Screen narrow>
        <MomoApprove
          key={momo.reference}
          unconfirmed={promptUnconfirmed}
          onResend={handleResend}
          resending={resending}
          resendNote={resendNote}
          amountLabel={formatGhs(params.totalAmount)}
          network={momo.network}
          payer={momo.payer}
          onPayAnotherWay={backToChoosing}
          seconds={Math.round((APPROVE_WAIT_ATTEMPTS * 1500) / 1000)}
        />
      </Screen>
    );
  }

  if (phase === "otp" && momo) {
    return (
      <Screen narrow>
        <TopBar title="Pay" onBack={backToChoosing} />
        <ScreenBody bottomInset={16}>
          <Gutter>
            <Text accessibilityRole="header" className="font-display text-heading text-ink">Enter the MoMo code</Text>
            <Text className="mb-6 mt-2 font-sans text-ui text-muted">
              Your network sent a code to {maskMomoNumber(momo.payer)}.
            </Text>
            <CodeInput
              value={code}
              onChangeText={(next) => {
                setCodeError(null);
                setCode(next.replace(/\D/g, "").slice(0, 6));
              }}
              state={codeError ? "error" : "default"}
              accessibilityLabel="Mobile Money SMS code"
            />
            {codeError ? (
              <Text accessibilityLiveRegion="assertive" role="alert" className="mt-4 font-sans text-body text-danger">
                {codeError}
              </Text>
            ) : null}
          </Gutter>
        </ScreenBody>
        <ActionBar>
          <Button
            label="Confirm"
            onPress={handleSubmitCode}
            disabled={code.length !== 6 || submitCode.isPending}
            loading={submitCode.isPending}
          />
          <Button label="Use another number" variant="quiet" onPress={backToChoosing} />
        </ActionBar>
      </Screen>
    );
  }

  if (phase === "confirming") {
    return (
      <Screen narrow>
        <ScreenBody bottomInset={16}>
          <Gutter className="pt-16 items-center">
            <ActivityIndicator color={colors.ink} />
            <Text className="mb-2 mt-6 text-center font-display text-heading text-ink">
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
        title="Pay"
        onBack={() => {
          showToast("Order saved. Pay any time from Orders.");
          exitPaymentToOrders(navigation);
        }}
      />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text accessibilityRole="header" className="mb-4 font-display text-heading text-ink">How do you want to pay?</Text>
          <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Payment method">
            <MethodRow
              label="Mobile Money"
              meta={
                moolreMomo
                  ? "MTN · Telecel · AT"
                  : (profile?.phone ?? "MTN · Telecel · AirtelTigo")
              }
              icon={<MobileIcon size={20} color={colors.ink} strokeWidth={1.7} />}
              selected={method === "momo"}
              onPress={() => setMethod("momo")}
            />
            {method === "momo" && moolreMomo ? (
              <View className="gap-4 rounded-card border border-hairline bg-surface p-4">
                <PhoneField label="MoMo number" value={momoDigits} onChangeText={changeMomoDigits} />
                <View>
                  <Text nativeID="momo-network" className="mb-2 font-sans-bold text-body text-ink">
                    Network
                  </Text>
                  <View
                    className="flex-row gap-2"
                    accessibilityRole="radiogroup"
                    aria-labelledby="momo-network"
                  >
                    {MOMO_NETWORKS.map((n) => (
                      <View key={n.id} className="flex-1">
                        <Chip
                          label={n.label}
                          selected={network === n.id}
                          onPress={() => {
                            setNetworkTouched(true);
                            setNetwork(n.id);
                          }}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
            {cardEnabled ? (
              <MethodRow
                label="Card"
                meta="Visa or Mastercard"
                icon={<CardIcon size={20} color={colors.ink} strokeWidth={1.7} />}
                selected={method === "card"}
                onPress={() => setMethod("card")}
              />
            ) : null}
          </View>

          <Text className="mt-6 font-sans text-body text-muted">
            {method === "momo" && moolreMomo
              ? "A prompt goes to this phone. Approve it with your MoMo PIN."
              : "Paystack handles the payment. You’ll stay in this tab and come straight back when you’re done."}
          </Text>
          {error ? (
            <Text
              accessibilityLiveRegion="assertive"
              role="alert"
              className="mt-4 font-sans text-body text-danger"
            >
              {error}
            </Text>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        {/* v7 canvas: the amount sits with the key that spends it. */}
        <View
          className="mb-3 flex-row items-end justify-between"
          accessible
          accessibilityLabel={`You're paying ${formatGhs(params.totalAmount)}`}
        >
          <Text className="font-sans text-ui text-muted">{sizeLabel ?? "Total"}</Text>
          <Text className="font-display text-ink" style={{ fontSize: 28, lineHeight: 32 }}>
            {formatGhs(params.totalAmount)}
          </Text>
        </View>
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
      accessibilityState={{ selected, checked: selected }}
      // `meta` carries the actual phone number the charge will go to, which is
      // the thing worth hearing before you commit — and selection was signalled
      // by a tinted ground and a check glyph, neither of which a screen reader
      // reports on its own.
      accessible
      accessibilityLabel={`${label}, ${meta}`}
      className={`min-h-[60px] flex-row items-center gap-3 rounded-card border-2 p-4 ${
        selected ? "border-ink bg-wash" : "border-line bg-surface"
      }`}
    >
      {icon}
      <View className="flex-1">
        <Text className="font-sans-bold text-ui text-ink">{label}</Text>
        <Text className="font-sans text-meta text-muted">{meta}</Text>
      </View>
      {selected ? <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}
