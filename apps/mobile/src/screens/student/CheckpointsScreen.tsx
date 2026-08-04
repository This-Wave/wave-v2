import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Card } from "../../components/ui/Card";
import { PinIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useCheckpoints } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";

/**
 * The campus drop-off points, read-only.
 *
 * Students pick a checkpoint per order, so there is no "default checkpoint" to
 * set here — nothing in the schema stores one. This exists so the Profile row
 * that pointed at it is no longer inert, and so a student can see where
 * deliveries actually land before they are standing in the wrong quad.
 */
export function CheckpointsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const universityId = useAuthStore((s) => s.profile?.universityId);
  const { data: checkpoints, isLoading, isError } = useCheckpoints(universityId ?? undefined);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Delivery checkpoints" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <Text className="mb-4 text-[13px] leading-[19px] text-muted">
          Your runner meets you at one of these. You choose which when you place an order.
        </Text>

        {isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isError ? (
          <Text className="py-6 text-center text-[13px] text-muted">
            Could not load checkpoints. Pull back and try again.
          </Text>
        ) : !checkpoints || checkpoints.length === 0 ? (
          <Text className="py-6 text-center text-[13px] text-muted">
            No checkpoints have been set up for your campus yet.
          </Text>
        ) : (
          <View className="gap-3">
            {checkpoints.map((cp) => (
              <Card key={cp.id} className="flex-row items-start gap-3 bg-surface">
                <View className="h-10 w-10 items-center justify-center rounded-control bg-canvas">
                  <PinIcon size={18} color={colors.ink} strokeWidth={1.6} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-semibold text-[14px] text-ink">{cp.name}</Text>
                  {cp.description ? (
                    <Text className="mt-0.5 text-[12px] leading-[17px] text-muted">{cp.description}</Text>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
