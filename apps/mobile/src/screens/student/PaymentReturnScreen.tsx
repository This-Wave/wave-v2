import { useEffect, useRef } from "react";
import { ActivityIndicator, Text } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { Gutter, Screen, ScreenBody } from "../../components/v6";
import { waitForPayment } from "../../lib/payments";
import { resetAfterPaymentOutcome } from "../../lib/navigationFlows";
import { colors } from "../../theme/tokens";

type Route = RouteProp<StudentStackParamList, "PaymentReturn">;

/**
 * Lands here after Paystack redirects back into the same browser tab.
 * Confirms via the API, then replaces itself with success or failure.
 */
export function PaymentReturnScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const cancel = useRef({ cancelled: false });

  useEffect(() => {
    const signal = cancel.current;
    return () => {
      signal.cancelled = true;
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    (async () => {
      const status = await waitForPayment(params.reference, {
        attempts: 40,
        signal: cancel.current,
      });
      if (stopped || cancel.current.cancelled) return;
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
    })();
    return () => {
      stopped = true;
    };
  }, [navigation, params.orderId, params.reference, params.totalAmount]);

  return (
    <Screen>
      <ScreenBody bottomInset={16}>
        <Gutter className="items-center pt-16">
          <ActivityIndicator color={colors.ink} />
          <Text className="mb-2 mt-6 text-center font-sans-bold text-heading text-ink">
            Confirming your payment
          </Text>
          <Text className="text-center font-sans text-body text-muted">
            You’re back in Wave. This takes a few seconds — don’t pay again.
          </Text>
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
