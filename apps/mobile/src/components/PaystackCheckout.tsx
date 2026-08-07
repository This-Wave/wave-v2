import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { Button, Gutter, TopBar } from "./v6";
import { colors } from "../theme/tokens";

/**
 * Paystack checkout, rendered inside the app wherever that is possible.
 *
 * **Why this is split by platform, and not by preference.** Paystack's checkout
 * page serves `x-frame-options: SAMEORIGIN`, so it cannot be put in an iframe by
 * anyone but Paystack. On native that is irrelevant — a `WebView` is a
 * top-level navigation, not a frame — so the real page renders in-app, which is
 * exactly what Paystack's own React Native SDK does. On Expo Web there is no
 * native webview: `react-native-webview` degrades to an iframe, which that
 * header blocks outright. Web therefore keeps an external tab. That is a
 * limitation of the dev harness, not of the pilot build, which ships native.
 *
 * **What "done" means here.** This component reports that the student finished
 * at the checkout page — nothing more. It never reports success. Only the signed
 * Paystack webhook can confirm an order, so the caller still waits for the
 * server. Completion is detected by watching for a navigation to the API's
 * `/v1/payments/callback` route, which is where Paystack sends the student
 * afterwards and which the server already serves a real page for.
 */

/** The server's post-checkout landing route. See modules/payments/routes.ts. */
const CALLBACK_PATH = "/v1/payments/callback";

export type CheckoutOutcome = "completed" | "dismissed";

export function PaystackCheckout({
  paymentUrl,
  onOutcome,
}: {
  paymentUrl: string;
  onOutcome: (outcome: CheckoutOutcome) => void;
}) {
  const [loading, setLoading] = useState(true);
  // Paystack's callback can fire more than one navigation event; without this
  // the caller would be told "completed" several times and could start several
  // confirmation polls.
  const settled = useRef(false);

  function settle(outcome: CheckoutOutcome) {
    if (settled.current) return;
    settled.current = true;
    onOutcome(outcome);
  }

  if (Platform.OS === "web") {
    return <WebCheckout paymentUrl={paymentUrl} onSettle={settle} />;
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
          // Paystack's MoMo flow opens the bank/telco step in a new window on
          // some channels; keeping it in this webview means the student never
          // leaves the app mid-payment.
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
 * Expo Web fallback.
 *
 * The tab is opened once, and then the screen simply *waits* — it does not
 * guess. The bug this replaces was the guessing: `openBrowserAsync` resolves
 * immediately on web, so the old code began a 7-second countdown the moment the
 * tab opened and then told a student who was still typing their MoMo PIN that
 * the payment could not be confirmed.
 *
 * The caller polls the server throughout, so a completed payment advances this
 * screen on its own. The button is a shortcut, not the mechanism.
 */
function WebCheckout({
  paymentUrl,
  onSettle,
}: {
  paymentUrl: string;
  onSettle: (outcome: CheckoutOutcome) => void;
}) {
  useEffect(() => {
    WebBrowser.openBrowserAsync(paymentUrl).catch(() => {
      /* Pop-up blocked — the link below is the way through. */
    });
  }, [paymentUrl]);

  return (
    <View className="flex-1 bg-canvas">
      <TopBar title="Payment" onBack={() => onSettle("dismissed")} />
      <Gutter className="flex-1 pt-8">
        <Text className="mb-2 font-sans-bold text-heading text-ink">
          Finish paying in the other tab
        </Text>
        <Text className="mb-8 font-sans text-body text-muted">
          Checkout opened in a new tab. Take as long as you need — this screen is watching, and it
          will move on by itself the moment your payment lands. Don't pay twice.
        </Text>

        <View className="mb-8 flex-row items-center gap-3 rounded-card bg-surface p-4">
          <ActivityIndicator color={colors.ink} />
          <Text className="flex-1 font-sans text-body text-ink">Waiting for your payment…</Text>
        </View>

        <Button
          label="Reopen the checkout tab"
          variant="quiet"
          onPress={() => WebBrowser.openBrowserAsync(paymentUrl)}
        />
      </Gutter>
    </View>
  );
}
