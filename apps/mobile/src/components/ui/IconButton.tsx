import { Pressable } from "react-native";
import type { LucideIcon } from "lucide-react-native";

interface IconButtonProps {
  icon: LucideIcon;
  onPress?: () => void;
  compact?: boolean;
}

export function IconButton({ icon: Icon, onPress, compact }: IconButtonProps) {
  const size = compact ? 34 : 36;
  return (
    <Pressable
      onPress={onPress}
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-well border border-border bg-surface"
    >
      <Icon size={compact ? 16 : 18} color="#1A1A1A" strokeWidth={2} />
    </Pressable>
  );
}
