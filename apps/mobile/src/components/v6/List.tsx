import { Image, Pressable, Text, View } from "react-native";
import { Children, type ReactNode } from "react";
import { ChevronRightIcon } from "../icons";
import { colors } from "../../theme/tokens";

/**
 * A list row. White card on canvas, 12px radius, no border. Rows in a group are
 * separated by a 4px canvas gap rather than a divider — the gap does the same
 * job as a hairline and keeps every corner rounded.
 */
export function Row({
  title,
  meta,
  leading,
  trailing,
  onPress,
  chevron = true,
}: {
  title: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      className="flex-row items-center gap-3 rounded-card bg-surface px-4 py-3.5 active:bg-hairline"
    >
      {leading}
      <View className="flex-1">
        <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text className="font-sans text-body text-muted" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress && chevron && !trailing ? (
        <ChevronRightIcon size={18} color={colors.subtle} strokeWidth={2} />
      ) : null}
    </Pressable>
  );
}

/**
 * Vertical stack of rows with the canvas showing between them.
 *
 * Collapses to nothing when every child is null — callers conditionally render
 * rows, and an all-empty group otherwise left a gap the size of its own margin.
 */
export function RowGroup({ children }: { children: ReactNode }) {
  const real = Children.toArray(children).filter(Boolean);
  if (real.length === 0) return null;
  return <View className="gap-1">{real}</View>;
}

/** Square thumbnail for a row's leading slot. */
export function Thumb({ uri, size = 44 }: { uri?: string | null; size?: number }) {
  return (
    <View
      style={{ width: size, height: size }}
      className="overflow-hidden rounded-input bg-surface-muted"
    >
      {uri ? <Image source={{ uri }} className="h-full w-full" resizeMode="cover" /> : null}
    </View>
  );
}

/**
 * Empty state. Deliberately plain: a line of ink, a line of muted, and at most
 * one action. The reference has no illustration vocabulary, so inventing one
 * here would be the loudest thing in the app.
 */
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center px-gutter py-16">
      <Text className="mb-1 text-center font-sans-medium text-ui text-ink">{title}</Text>
      {body ? (
        <Text className="mb-6 text-center font-sans text-body text-muted">{body}</Text>
      ) : null}
      {action}
    </View>
  );
}
