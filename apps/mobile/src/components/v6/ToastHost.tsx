import { useEffect } from "react";
import { AccessibilityInfo, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/tokens";
import { useToastStore } from "../../store/toastStore";

/** Global toast — auto-dismisses after a few seconds. */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    // The toast is the app's whole feedback channel — order placed, payment
    // failed, retry succeeded — and it renders without moving focus. Without an
    // explicit announcement a screen-reader user places an order and hears
    // nothing at all. 4.1.3.
    AccessibilityInfo.announceForAccessibility(toast.message);
    const timer = setTimeout(dismiss, 3800);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;

  const bg =
    toast.tone === "success"
      ? colors.lime
      : toast.tone === "danger"
        ? colors.surface
        : colors.ink;

  const textColor = toast.tone === "success" ? colors.ink : colors.surface;

  return (
    <View
      pointerEvents="box-none"
      // Belt and braces alongside the announce above: RN Web maps this to
      // aria-live, where announceForAccessibility is a no-op.
      accessibilityLiveRegion={toast.tone === "danger" ? "assertive" : "polite"}
      role={toast.tone === "danger" ? "alert" : "status"}
      style={{
        position: "absolute",
        top: insets.top + (Platform.OS === "web" ? 12 : 8),
        left: 16,
        right: 16,
        zIndex: 9999,
        alignItems: "center",
      }}
    >
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel={`${toast.message}. Dismiss.`}
        className="max-w-lg rounded-pill px-5 py-3"
        style={{
          backgroundColor: bg,
          borderWidth: toast.tone === "danger" ? 1 : 0,
          borderColor: colors.danger,
          ...(Platform.OS === "web"
            ? ({ boxShadow: "0 4px 20px rgba(8,52,0,0.12)" } as object)
            : {}),
        }}
      >
        <Text className="text-center font-sans-medium text-body" style={{ color: textColor }}>
          {toast.message}
        </Text>
      </Pressable>
    </View>
  );
}
