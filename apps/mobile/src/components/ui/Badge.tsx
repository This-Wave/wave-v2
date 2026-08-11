import { Text, View } from "react-native";

type Variant = "success" | "error" | "warning" | "neutral" | "solid";

// v5 status pills: lime fill + green text for positive, quiet canvas chip otherwise.
const VARIANT_BG: Record<Variant, string> = {
  success: "bg-wave-lime",
  error: "bg-danger-bg",
  warning: "bg-warning-bg",
  neutral: "border border-border bg-canvas",
  solid: "bg-wave-500",
};

const VARIANT_TEXT: Record<Variant, string> = {
  success: "text-wave-500",
  error: "text-danger-text",
  warning: "text-warning-text",
  neutral: "text-muted",
  solid: "text-wave-lime",
};

interface BadgeProps {
  label: string;
  variant?: Variant;
  pulse?: boolean;
}

export function Badge({ label, variant = "neutral", pulse }: BadgeProps) {
  return (
    <View
      className={`self-start rounded-pill px-2.5 py-1 ${VARIANT_BG[variant]}`}
      style={pulse ? { opacity: 0.92 } : undefined}
    >
      <Text className={`font-sans-semibold text-[11px] capitalize ${VARIANT_TEXT[variant]}`}>{label}</Text>
    </View>
  );
}
