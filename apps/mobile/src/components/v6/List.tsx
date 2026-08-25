import { Image, Pressable, Text, View } from "react-native";
import { Children, type ReactNode } from "react";
import { ChevronRightIcon } from "../icons";
import { colors } from "../../theme/tokens";
import { useLayout } from "../../hooks/useLayout";

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
  accessibilityLabel,
}: {
  title: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel ?? title}
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
  // Inline gap — NativeWind `gap-*` is unreliable on RN Web, so cards were flush.
  return <View style={{ gap: 8 }}>{real}</View>;
}

/** Distinct from empty — a failed fetch with retry. */
export function ListError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const { gutter } = useLayout();
  return (
    <View className="rounded-card bg-surface p-5" style={{ marginHorizontal: gutter }}>
      <Text className="mb-1 font-sans-medium text-body text-ink">Couldn&apos;t load</Text>
      <Text className="mb-4 font-sans text-body text-muted">
        {message ?? "Check your connection and try again."}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        className="self-start rounded-pill bg-lime px-4 py-2.5 active:bg-lime-600"
      >
        <Text className="font-sans-medium text-body text-ink">Retry</Text>
      </Pressable>
    </View>
  );
}

/** Skeleton rows for list loading states. */
export function ListSkeleton({ rows = 3, height = 64 }: { rows?: number; height?: number }) {
  const { gutter } = useLayout();
  return (
    <View style={{ gap: 8, paddingHorizontal: gutter }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="rounded-card bg-surface p-4" style={{ height }} />
      ))}
    </View>
  );
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
  const { gutter } = useLayout();
  return (
    <View className="items-center py-16" style={{ paddingHorizontal: gutter }}>
      <Text className="mb-1 text-center font-sans-medium text-ui text-ink">{title}</Text>
      {body ? (
        <Text className="mb-6 text-center font-sans text-body text-muted">{body}</Text>
      ) : null}
      {action}
    </View>
  );
}
