import { Text, View } from "react-native";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "../icons";
import { colors } from "../../theme/tokens";
import { IconCircle } from "./Controls";

/**
 * Stack header. A back disc, an optional centred title, and an optional trailing
 * slot. Sits on the canvas with no border and no shadow — the reference keeps
 * chrome off the header entirely and lets the content below carry the page.
 */
export function TopBar({
  title,
  onBack,
  trailing,
}: {
  title?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View className="h-16 flex-row items-center justify-between px-gutter">
      <View className="w-10">
        {onBack ? (
          <IconCircle onPress={onBack} accessibilityLabel="Go back">
            <ChevronLeftIcon size={20} color={colors.ink} strokeWidth={2} />
          </IconCircle>
        ) : null}
      </View>
      {title ? (
        <Text className="flex-1 text-center font-sans-medium text-ui text-ink" numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View className="flex-1" />
      )}
      <View className="w-10 items-end">{trailing}</View>
    </View>
  );
}

/**
 * The home header: wordmark left, actions right. The wordmark is the one place
 * the accent appears as a mark rather than an action — the reference allows the
 * logo exactly this exemption.
 */
export function BrandBar({ trailing }: { trailing?: ReactNode }) {
  return (
    <View className="h-16 flex-row items-center justify-between px-gutter">
      <View className="flex-row items-center gap-2">
        <View className="h-7 w-7 items-center justify-center rounded-pill bg-lime">
          <Text className="font-sans-bold text-body text-ink">W</Text>
        </View>
        <Text className="font-sans-bold text-subheading text-ink">wave</Text>
      </View>
      <View className="flex-row items-center gap-2">{trailing}</View>
    </View>
  );
}
