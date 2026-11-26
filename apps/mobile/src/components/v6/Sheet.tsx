import { Modal, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { CloseIcon } from "../icons";
import { colors } from "../../theme/tokens";
import { useLayout } from "../../hooks/useLayout";

/**
 * Bottom sheet. The one place the system uses real elevation — it floats over
 * the page, so it earns a shadow and a scrim where a card would not.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { isDesktop } = useLayout();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktop ? "fade" : "slide"}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {/* v7 canvas: a bottom sheet on phones, a centred dialog on desktop. */}
      <View className={`flex-1 ${isDesktop ? "items-center justify-center" : "justify-end"}`}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
          className={isDesktop ? "absolute inset-0" : "flex-1"}
          style={{ backgroundColor: "rgba(15,28,24,0.35)" }}
        />
        <Pressable
          onPress={() => undefined}
          style={isDesktop ? { width: 480, maxWidth: "92%" } : undefined}
          accessibilityRole="none"
          importantForAccessibility="yes"
          accessibilityLabel={title}
        >
          <View
            className="bg-surface px-gutter pb-8 pt-3"
            style={isDesktop ? { borderRadius: 16 } : { borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            accessibilityRole="summary"
          >
            {/* v7 canvas: grab handle, Nunito title, square close key. */}
            {isDesktop ? <View className="h-3" /> : <View className="mb-4 h-[5px] w-10 self-center rounded-pill bg-line" />}
            <View className="mb-4 flex-row items-center justify-between" style={{ gap: 12 }}>
              <Text className="flex-1 font-display text-heading text-ink" accessibilityRole="header">
                {title ?? ""}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close sheet"
                className="h-11 w-11 items-center justify-center rounded-input border-2 border-hairline bg-surface"
              >
                <CloseIcon size={18} color={colors.ink} strokeWidth={2} />
              </Pressable>
            </View>
            {children}
            {footer ? <View className="pt-5">{footer}</View> : null}
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

/** Centred confirmation dialog for a single destructive choice. */
export function Confirm({
  visible,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: "rgba(8,52,0,0.45)" }}
        accessibilityRole="none"
      >
        <View
          className="w-full rounded-card border border-hairline bg-surface p-6"
          accessibilityRole="alert"
          accessibilityLabel={title}
        >
          <Text className="mb-2 font-sans-bold text-subheading text-ink">{title}</Text>
          {body ? <Text className="mb-6 font-sans text-body text-muted">{body}</Text> : null}
          <View className="gap-2">
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              className="h-12 items-center justify-center rounded-pill bg-danger"
            >
              <Text className="font-sans-medium text-ui text-white">{confirmLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              className="h-12 items-center justify-center rounded-pill"
            >
              <Text className="font-sans-bold text-ui text-ink">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
