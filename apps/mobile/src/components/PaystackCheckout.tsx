import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Button, Gutter, TopBar } from "./v6";
import { colors } from "../theme/tokens";
import { stashPendingPayment, type PendingPayment } from "../lib/paymentReturn";

/**
 * Paystack checkout, in-app on native and same-tab on web.
 *
 * Native uses a WebView. Web cannot iframe Paystack (x-frame-options), so we
 * navigate this tab to Paystack and come back via `callback_url` → success.
 */

const CALLBACK_PATH = "/v1/payments/callback";

export type CheckoutOutcome = "completed" | "dismissed";

export function PaystackCheckout({
  paymentUrl,
  pending,
  onOutcome,
}: {
  paymentUrl: string;
  /** Required on web so we can restore the order after the tab returns. */
  pending?: PendingPayment;
  onOutcome: (outcome: CheckoutOutcome) => void;
}) {
  const [loading, setLoading] = useState(true);
  const settled = useRef(false);

  function settle(outcome: CheckoutOutcome) {
    if (settled.current) return;
    settled.current = true;
    onOutcome(outcome);
  }

  if (Platform.OS === "web") {
    return (
      <WebCheckout
        paymentUrl={paymentUrl}
        pending={pending}
        onSettle={settle}
      />
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <TopBar title="Payment" onBack={() => settle("dismissed")} />
      <View className="flex-1">
        <WebView
          source={{ uri: paymentUrl }}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(nav: WebViewNavigation) => {
            if (nav.url?.includes(CALLBACK_PATH)) settle("completed");
          }}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
        />
        {loading ? (
          <View className="absolute inset-0 items-center justify-center bg-surface">
            <ActivityIndicator color={colors.ink} />
            <Text className="mt-3 font-sans text-body text-muted">Opening secure checkout…</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Same-tab web checkout. Stashes the order, then replaces this tab with
 * Paystack. Paystack’s callback brings the student back to the app origin;
 * `PaymentReturnListener` finishes the trip to the success screen.
 */
function WebCheckout({
  paymentUrl,
  pending,
  onSettle,
}: {
  paymentUrl: string;
  pending?: PendingPayment;
  onSettle: (outcome: CheckoutOutcome) => void;
}) {
  useEffect(() => {
    if (pending) stashPendingPayment(pending);
    // Full navigation in this tab — not a popup / new tab.
    window.location.assign(paymentUrl);
  }, [paymentUrl, pending]);

  return (
    <View className="flex-1 bg-canvas">
      <TopBar title="Payment" onBack={() => onSettle("dismissed")} />
      <Gutter className="flex-1 pt-8">
        <Text className="mb-2 font-sans-bold text-heading text-ink">Taking you to Paystack…</Text>
        <Text className="mb-8 font-sans text-body text-muted">
          You’ll pay in this tab, then come straight back to Wave when you’re done.
        </Text>
        <View className="mb-8 flex-row items-center gap-3 rounded-card bg-surface p-4">
          <ActivityIndicator color={colors.ink} />
          <Text className="flex-1 font-sans text-body text-ink">Opening secure checkout…</Text>
        </View>
        <Button
          label="Continue to Paystack"
          variant="quiet"
          onPress={() => {
            if (pending) stashPendingPayment(pending);
            window.location.assign(paymentUrl);
          }}
        />
      </Gutter>
    </View>
  );
}
