import { Modal, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { CloseIcon } from "../icons";
import { colors } from "../../theme/tokens";
import { IconCircle } from "./Controls";

/**
 * Bottom sheet. The one place the system uses real elevation — it floats over
 * the page, so it earns a shadow and a scrim where a card would not.
 *
 * Corners are 24px rather than the card's 12px: a sheet is a different object
 * from a card, and matching radii would make it read as one that had slid up.
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Dismiss"
        className="flex-1"
        style={{ backgroundColor: "rgba(8,52,0,0.45)" }}
      />
      <View
        className="bg-surface px-gutter pb-8 pt-4"
        style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-sans-medium text-heading-sm text-ink">{title ?? ""}</Text>
          <IconCircle onPress={onClose} tone="transparent" accessibilityLabel="Close">
            <CloseIcon size={20} color={colors.ink} strokeWidth={2} />
          </IconCircle>
        </View>
        {children}
        {footer ? <View className="pt-5">{footer}</View> : null}
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: "rgba(8,52,0,0.45)" }}
      >
        <View className="w-full rounded-card bg-surface p-6">
          <Text className="mb-2 font-sans-medium text-subheading text-ink">{title}</Text>
          {body ? <Text className="mb-6 font-sans text-body text-muted">{body}</Text> : null}
          <View className="gap-2">
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              className="h-12 items-center justify-center rounded-pill bg-danger"
            >
              <Text className="font-sans-medium text-ui text-white">{confirmLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
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
