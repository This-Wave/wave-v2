import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { IconButton } from "./IconButton";
import { ChevronLeftIcon } from "../icons";

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  trailing?: ReactNode;
}

/**
 * The v5 stack header: back chip + 18px semibold title, hairline rule beneath.
 * Used on every pushed screen (05, 06, 07, 09, 10, 11, 13, 15, 16, 18, 19).
 */
export function ScreenHeader({ title, onBack, trailing }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center gap-3 border-b border-border px-5 pb-4">
      {onBack ? (
        <IconButton onPress={onBack}>
          <ChevronLeftIcon />
        </IconButton>
      ) : null}
      <Text className="flex-1 font-sans-semibold text-[18px] text-ink" numberOfLines={1}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}
