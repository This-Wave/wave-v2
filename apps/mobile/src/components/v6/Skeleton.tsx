import { View } from "react-native";

/**
 * Loading placeholder. Static `#dddddd` (Deco) — the reference names it exactly
 * for this. No shimmer: an animated gradient would be the most eye-catching
 * thing in an interface whose whole premise is that nothing competes with the
 * photography.
 */
export function Skeleton({
  width,
  height,
  radius = 8,
  className = "",
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  className?: string;
}) {
  return (
    <View
      style={{ width: width ?? "100%", height, borderRadius: radius }}
      className={`bg-surface-muted ${className}`}
    />
  );
}

/** Placeholder matching `PhotoCard`'s footprint. */
export function SkeletonCard({ width }: { width: number }) {
  return (
    <View style={{ width }}>
      <Skeleton width={width} height={width} radius={12} />
      <View className="gap-1.5 pt-3">
        <Skeleton height={14} radius={4} width="80%" />
        <Skeleton height={14} radius={4} width="55%" />
      </View>
    </View>
  );
}
