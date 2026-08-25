import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { CommonActions } from "@react-navigation/native";
import { navigationRef } from "../lib/navigationRef";
import { consumePaymentReturn } from "../lib/paymentReturn";
import { useAuthStore } from "../store/authStore";

/**
 * After a same-tab Paystack redirect, route into PaymentReturn once auth and
 * navigation are ready.
 */
export function PaymentReturnListener() {
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const accessToken = useAuthStore((s) => s.accessToken);
  const handled = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || handled.current || isHydrating || !accessToken) return;

    const pending = consumePaymentReturn();
    if (!pending) return;
    handled.current = true;

    const tryNavigate = () => {
      if (!navigationRef.isReady()) {
        requestAnimationFrame(tryNavigate);
        return;
      }
      navigationRef.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "Tabs", params: { screen: "Home" } },
            {
              name: "PaymentReturn",
              params: {
                orderId: pending.orderId,
                reference: pending.reference,
                totalAmount: pending.totalAmount,
              },
            },
          ],
        }),
      );
    };
    tryNavigate();
  }, [isHydrating, accessToken]);

  return null;
}
