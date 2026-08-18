import { Modal, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { CloseIcon } from "../icons";
import { colors } from "../../theme/tokens";
import { IconCircle } from "./Controls";

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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View className="flex-1 justify-end">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
          className="flex-1"
          style={{ backgroundColor: "rgba(8,52,0,0.45)" }}
        />
        <Pressable
          onPress={() => undefined}
          accessibilityRole="none"
          importantForAccessibility="yes"
          accessibilityLabel={title}
        >
          <View
            className="bg-surface px-gutter pb-8 pt-4"
            style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            accessibilityRole="summary"
          >
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="font-sans-medium text-heading-sm text-ink" accessibilityRole="header">
                {title ?? ""}
              </Text>
              <IconCircle onPress={onClose} tone="transparent" accessibilityLabel="Close sheet">
                <CloseIcon size={20} color={colors.ink} strokeWidth={2} />
              </IconCircle>
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
          className="w-full rounded-card bg-surface p-6"
          accessibilityRole="alert"
          accessibilityLabel={title}
        >
          <Text className="mb-2 font-sans-medium text-subheading text-ink">{title}</Text>
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
              <Text className="font-sans-medium text-ui text-ink">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
