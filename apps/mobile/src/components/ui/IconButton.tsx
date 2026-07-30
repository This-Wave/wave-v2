import { Pressable } from "react-native";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";
import { colors } from "../../theme/tokens";

interface IconButtonProps {
  /** v5 icons are passed as children; `icon` stays for Lucide-based rider/shop screens. */
  children?: ReactNode;
  icon?: LucideIcon;
  onPress?: () => void;
  compact?: boolean;
  /** Filled green treatment, e.g. the call button on order tracking. */
  filled?: boolean;
}

// v5: 40x40 white square, 18px radius, hairline border.
export function IconButton({ children, icon: Icon, onPress, compact, filled }: IconButtonProps) {
  const size = compact ? 36 : 40;
  return (
    <Pressable
      onPress={onPress}
      style={{ width: size, height: size }}
      className={`items-center justify-center rounded-control ${
        filled ? "bg-wave-500" : "border border-border bg-surface"
      }`}
    >
      {children ?? (Icon ? <Icon size={compact ? 16 : 18} color={filled ? colors.white : colors.ink} strokeWidth={1.8} /> : null)}
    </Pressable>
  );
}
