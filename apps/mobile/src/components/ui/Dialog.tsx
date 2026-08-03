import { Modal, Text, View } from "react-native";
import type { ReactNode } from "react";
import { Button } from "./Button";

interface DialogProps {
  visible: boolean;
  icon?: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * v5 screen 20: a 55%-opacity #0A1707 scrim over the screen, then a white 24px
 * card with a 52px warning well, stacked destructive + dismiss buttons.
 */
export function Dialog({
  visible,
  icon,
  title,
  description,
  confirmLabel,
  cancelLabel = "Keep order",
  destructive = true,
  onConfirm,
  onCancel,
  loading,
}: DialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(10,23,7,0.55)" }}>
        <View className="w-full rounded-card bg-surface p-[26px]">
          {icon ? (
            <View className="mb-[18px] h-[52px] w-[52px] items-center justify-center rounded-control bg-warning-bg">
              {icon}
            </View>
          ) : null}
          <Text className="mb-2.5 font-sans-semibold text-[20px] text-ink">{title}</Text>
          <Text className="mb-6 text-[14px] leading-[21px] text-muted">{description}</Text>
          <View className="gap-3">
            <Button
              label={confirmLabel}
              variant={destructive ? "danger" : "primary"}
              size="compact"
              onPress={onConfirm}
              loading={loading}
            />
            <Button label={cancelLabel} variant="secondary" size="compact" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
