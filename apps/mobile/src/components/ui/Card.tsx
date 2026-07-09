import type { ReactNode } from "react";
import { View } from "react-native";

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ children, className = "", padded = true }: CardProps) {
  return (
    <View className={`rounded-card border border-border bg-surface ${padded ? "p-3.5" : ""} ${className}`}>
      {children}
    </View>
  );
}
