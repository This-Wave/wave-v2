import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { shadowCard } from "../../theme/tokens";

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /** v5 raises the primary card on each screen; list rows sit flat. */
  elevated?: boolean;
  style?: ViewStyle;
}

export function Card({ children, className = "", padded = true, elevated, style }: CardProps) {
  return (
    <View
      className={`rounded-card border border-border bg-surface ${padded ? "p-4" : ""} ${className}`}
      style={elevated ? [shadowCard, style] : style}
    >
      {children}
    </View>
  );
}
