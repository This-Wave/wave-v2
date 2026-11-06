import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { navigationRef, openOrder } from "../lib/navigationRef";
import { consumeOpenOrderParam } from "../lib/webPush";
import { useAuthStore } from "../store/authStore";

type Role = "student" | "rider" | "other";

/**
 * The web counterpart of `NotificationProvider`'s Expo listeners: the service
 * worker posts `wave:push` when a notification arrives and `wave:open-order`
 * when one is tapped with the app already open; a tap with the app closed opens
 * `/?order=<id>` instead.
 */
export function WebPushListener() {
  const queryClient = useQueryClient();
  const profileRole = useAuthStore((s) => s.profile?.role);
  const role: Role = profileRole === "rider" ? "rider" : profileRole === "student" ? "student" : "other";
  const consumed = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent<{ type?: string; orderId?: unknown }>) => {
      if (event.data?.type === "wave:push") {
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
      }
      if (event.data?.type === "wave:open-order" && typeof event.data.orderId === "string") {
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        openOrder(event.data.orderId, role);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [queryClient, role]);

  useEffect(() => {
    // Wait for the profile: the order screens only exist in the signed-in stacks.
    if (consumed.current || !profileRole) return;
    const orderId = consumeOpenOrderParam();
    consumed.current = true;
    if (!orderId) return;

    const tryOpen = () => {
      if (!navigationRef.isReady()) {
        requestAnimationFrame(tryOpen);
        return;
      }
      openOrder(orderId, role);
    };
    tryOpen();
  }, [profileRole, role]);

  return null;
}
