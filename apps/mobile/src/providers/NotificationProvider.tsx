import { useEffect, type ReactNode } from "react";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { configureNotificationHandler } from "../lib/notifications";
import { openOrder } from "../lib/navigationRef";
import { useAuthStore } from "../store/authStore";

// Expo requires the handler to be set before any notification can arrive, so
// it runs at module load rather than inside the component body.
configureNotificationHandler();

/**
 * Keeps cached order data honest when a push arrives, and takes the student to
 * the order the notification is about.
 *
 * Every notification the API sends announces a status the app also fetches, so
 * both a foreground arrival and a tap drop the `orders` cache and let the
 * screen refetch. That way someone who taps "Your order has arrived" never
 * lands on a screen still showing "on the way".
 *
 * A tap additionally navigates. The payload has always carried `orderId`
 * (`dispatch.ts` puts it there); nothing was reading it, so tapping a
 * notification left you exactly where you were.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.profile?.role);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    });

    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      const data = response.notification.request.content.data as { orderId?: unknown };
      if (typeof data?.orderId !== "string") return;

      openOrder(data.orderId, role === "rider" ? "rider" : role === "student" ? "student" : "other");
    });

    return () => {
      received.remove();
      responded.remove();
    };
  }, [queryClient, role]);

  return <>{children}</>;
}
