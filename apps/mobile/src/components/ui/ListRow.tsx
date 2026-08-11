import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { shadowCard } from "../../theme/tokens";

interface ListRowProps {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Legacy grouped-list divider. v5 prefers `card` rows with their own border. */
  bordered?: boolean;
  danger?: boolean;
  /** v5 standalone card row: white, hairline border, 24px radius. */
  card?: boolean;
  elevated?: boolean;
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  disabled,
  bordered,
  danger,
  card,
  elevated,
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={elevated ? shadowCard : undefined}
      className={`flex-row items-center gap-3 ${
        card ? "rounded-card border border-border bg-surface p-3.5" : "px-4 py-4"
      } ${bordered ? "border-b border-border" : ""} ${disabled ? "opacity-50" : ""}`}
    >
      {leading}
      <View className="flex-1">
        <Text
          className={`font-sans-semibold text-[14px] ${danger ? "text-danger-text" : "text-ink"}`}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-[12px] text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}
