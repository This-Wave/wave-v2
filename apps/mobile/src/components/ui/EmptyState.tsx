import type { ReactNode } from "react";
import { Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

type Severity = "neutral" | "error" | "success";

const SEVERITY_BG: Record<Severity, string> = {
  neutral: "bg-surface-muted",
  error: "bg-danger-bg",
  success: "bg-wave-500",
};

const SEVERITY_ICON_COLOR: Record<Severity, string> = {
  neutral: "#9E9E9E",
  error: "#D32F2F",
  success: "#fff",
};

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  severity?: Severity;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, severity = "neutral", children }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className={`mb-5 h-16 w-16 items-center justify-center rounded-full ${SEVERITY_BG[severity]}`}>
        <Icon size={30} color={SEVERITY_ICON_COLOR[severity]} strokeWidth={1.6} />
      </View>
      <Text className="mb-2 text-center font-sans-extrabold text-[21px] text-ink">{title}</Text>
      <Text className="mb-6 text-center text-[13px] leading-5 text-muted">{description}</Text>
      {children ? <View className="w-full gap-3">{children}</View> : null}
    </View>
  );
}
