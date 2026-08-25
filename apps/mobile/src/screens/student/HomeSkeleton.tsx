import { View } from "react-native";
import { Gutter, Skeleton, SkeletonCard } from "../../components/v6";

/** Home's loading state — the search capsule, a chip rail, and one card row. */
export function HomeSkeleton() {
  return (
    <View className="pt-1">
      <Gutter className="pb-6">
        <Skeleton height={64} radius={9999} />
      </Gutter>
      <View className="mb-6 flex-row gap-2 px-gutter">
        <Skeleton width={64} height={36} radius={9999} />
        <Skeleton width={84} height={36} radius={9999} />
        <Skeleton width={72} height={36} radius={9999} />
      </View>
      <Gutter className="mb-3">
        <Skeleton width={180} height={26} radius={6} />
      </Gutter>
      <View className="flex-row gap-3 px-gutter">
        <SkeletonCard width={168} />
        <SkeletonCard width={168} />
      </View>
    </View>
  );
}
