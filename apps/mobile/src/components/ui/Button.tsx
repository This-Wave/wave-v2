import { Pressable, Text, ActivityIndicator } from "react-native";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}

const VARIANT_BG: Record<Variant, string> = {
  primary: "bg-wave-500",
  secondary: "bg-surface-muted",
  danger: "bg-warning-text",
};

const VARIANT_TEXT: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-ink",
  danger: "text-white",
};

export function Button({ label, onPress, variant = "primary", disabled, loading }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`h-[52px] w-full items-center justify-center rounded-control ${
        isDisabled ? "bg-disabled-bg" : VARIANT_BG[variant]
      }`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? "#1A1A1A" : "#fff"} />
      ) : (
        <Text
          className={`font-sans-semibold text-[15px] ${
            isDisabled ? "text-disabled-text" : VARIANT_TEXT[variant]
          }`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
