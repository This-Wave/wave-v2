import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

interface ListRowProps {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  bordered?: boolean;
  danger?: boolean;
}

export function ListRow({ leading, title, subtitle, trailing, onPress, disabled, bordered, danger }: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center px-3 py-3 ${bordered ? "border-b border-surface-muted" : ""} ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {leading ? <View className="mr-2.5">{leading}</View> : null}
      <View className="flex-1">
        <Text className={`font-sans-semibold text-[13px] ${danger ? "text-danger-text" : "text-ink"}`} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-[11px] text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View className="ml-2 flex-shrink-0">{trailing}</View> : null}
    </Pressable>
  );
}
