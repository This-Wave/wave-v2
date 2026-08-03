import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "lime";
type Size = "default" | "compact";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}

// v5 buttons: 52px tall (50px for the secondary/ghost pair), 18px radius.
const VARIANT_BG: Record<Variant, string> = {
  primary: "bg-wave-500",
  secondary: "border border-border bg-surface",
  danger: "bg-danger-text",
  lime: "bg-wave-lime",
};

const VARIANT_TEXT: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-ink",
  danger: "text-white",
  lime: "text-wave-500",
};

const SPINNER_COLOR: Record<Variant, string> = {
  primary: "#ffffff",
  secondary: "#10210B",
  danger: "#ffffff",
  lime: "#009933",
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "default",
  disabled,
  loading,
  icon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const height = size === "compact" ? "h-[50px]" : "h-[52px]";
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={style}
      className={`${height} w-full flex-row items-center justify-center gap-2 rounded-control ${
        isDisabled ? "bg-disabled-bg" : VARIANT_BG[variant]
      }`}
    >
      {loading ? (
        <ActivityIndicator color={SPINNER_COLOR[variant]} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text
            className={`font-sans-semibold text-[15px] ${
              isDisabled ? "text-disabled-text" : VARIANT_TEXT[variant]
            }`}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
