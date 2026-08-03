import { SafeAreaView, View } from "react-native";
import { Skeleton } from "../../components/ui/Skeleton";

/**
 * v5 screen 21 — the loading shape of Home. Blocks mirror the real layout:
 * the 186px hero, the four 52px quick-action tiles, two labelled sections.
 */
export function HomeSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 px-5 pt-4">
        <Skeleton height={186} radius={24} />
        <View className="mb-6 mt-5 flex-row justify-between">
          <Skeleton width={52} height={52} radius={18} />
          <Skeleton width={52} height={52} radius={18} />
          <Skeleton width={52} height={52} radius={18} />
          <Skeleton width={52} height={52} radius={18} />
        </View>
        <Skeleton width={160} height={18} radius={8} />
        <View className="mb-6 mt-3.5">
          <Skeleton height={78} radius={24} />
        </View>
        <Skeleton width={160} height={18} radius={8} />
        <View className="mt-3.5 flex-row gap-2.5">
          <Skeleton height={96} radius={24} className="flex-1" />
          <Skeleton height={96} radius={24} className="flex-1" />
        </View>
      </View>
    </SafeAreaView>
  );
}
