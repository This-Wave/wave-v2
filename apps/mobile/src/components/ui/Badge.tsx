import { Text, View } from "react-native";

type Variant = "success" | "error" | "warning" | "neutral";

const VARIANT_CLASS: Record<Variant, string> = {
  success: "bg-success-bg text-success-text",
  error: "bg-danger-bg text-danger-text",
  warning: "bg-warning-bg text-warning-text",
  neutral: "bg-surface-muted text-text-secondary",
};

interface BadgeProps {
  label: string;
  variant?: Variant;
  pulse?: boolean;
}

export function Badge({ label, variant = "neutral", pulse }: BadgeProps) {
  const [bgClass, textClass] = VARIANT_CLASS[variant].split(" ");
  return (
    <View className={`self-start rounded-pill px-2.5 py-1 ${bgClass}`} style={pulse ? { opacity: 0.92 } : undefined}>
      <Text className={`font-sans-bold text-[10px] ${textClass}`}>{label}</Text>
    </View>
  );
}
