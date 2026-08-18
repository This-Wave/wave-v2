import type { ReactNode } from "react";
import { Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

type Severity = "neutral" | "error" | "success";

// v5 screens 18/19: 84x84 rounded-24 icon well, 20px title, 14px muted body.
const SEVERITY_BG: Record<Severity, string> = {
  neutral: "bg-canvas border border-border",
  error: "bg-danger-bg",
  success: "bg-wave-lime",
};

const SEVERITY_ICON_COLOR: Record<Severity, string> = {
  neutral: "#6B7D63",
  error: "#B3453A",
  success: "#083400",
};

interface EmptyStateProps {
  /** v5 art/icon passed as `art`; `icon` stays for Lucide-based rider/shop screens. */
  art?: ReactNode;
  icon?: LucideIcon;
  title: string;
  description: string;
  severity?: Severity;
  children?: ReactNode;
}

export function EmptyState({ art, icon: Icon, title, description, severity = "neutral", children }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-10">
      <View className={`mb-6 h-[84px] w-[84px] items-center justify-center rounded-card ${SEVERITY_BG[severity]}`}>
        {art ?? (Icon ? <Icon size={34} color={SEVERITY_ICON_COLOR[severity]} strokeWidth={1.6} /> : null)}
      </View>
      <Text className="mb-2.5 text-center font-sans-semibold text-[20px] text-ink">{title}</Text>
      <Text className="mb-7 text-center text-[14px] leading-[21px] text-muted">{description}</Text>
      {children ? <View className="w-full gap-3">{children}</View> : null}
    </View>
  );
}
