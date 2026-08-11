import { useEffect } from "react";
import { Platform, Pressable, Text, View } from "react-native";
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
        accessibilityLabel="Dismiss message"
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
