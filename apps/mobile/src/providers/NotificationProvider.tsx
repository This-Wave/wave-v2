import { useEffect, type ReactNode } from "react";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { configureNotificationHandler } from "../lib/notifications";

// Expo requires the handler to be set before any notification can arrive, so
// it runs at module load rather than inside the component body.
configureNotificationHandler();

/**
 * Keeps cached order data honest when a push arrives.
 *
 * Every notification the API sends announces a status the app also fetches, so
 * both a foreground arrival and a tap do the same thing: drop the `orders`
 * cache and let the screen refetch. That way the student who taps "Your order
 * has arrived" never lands on a screen still showing "on the way".
 *
 * Tapping does not yet navigate to the order it names — that needs a
 * navigation ref wired through `RootNavigator`, and the payload already
 * carries `orderId` for when it is.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    });
    const responded = Notifications.addNotificationResponseReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    });

    return () => {
      received.remove();
      responded.remove();
    };
  }, [queryClient]);

  return <>{children}</>;
}
