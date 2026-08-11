import { Text, View } from "react-native";
import {
  Empty,
  Gutter,
  Screen,
  ScreenBody,
  Skeleton,
} from "../../../components/v6";
import { useCheckpoints } from "../../../lib/checkpoints";
import { useAuthStore } from "../../../store/authStore";
import { useLayout } from "../../../hooks/useLayout";
import { PinIcon } from "../../../components/icons";
import { colors } from "../../../theme/tokens";

/** Desktop checkpoints — card grid instead of a phone list. */
export function StudentCheckpointsWeb() {
  const universityId = useAuthStore((s) => s.profile?.universityId);
  const { data: checkpoints, isLoading, isError } = useCheckpoints(universityId ?? undefined);
  const { contentWidth, gutter } = useLayout();
  const cols = contentWidth >= 1100 ? 3 : 2;
  const cardWidth = (contentWidth - gutter * 2 - 16 * (cols - 1)) / cols;

  return (
    <Screen>
      <ScreenBody bottomInset={48}>
        <Gutter className="pb-8 pt-8">
          <Text className="font-sans-bold text-heading text-ink">Checkpoints</Text>
          <Text className="mt-1 font-sans text-ui text-muted">
            Your runner meets you at one of these. You choose which when you place an order.
          </Text>
        </Gutter>

        <Gutter>
          {isLoading ? (
            <View className="flex-row flex-wrap" style={{ gap: 16 }}>
              {Array.from({ length: cols }, (_, i) => (
                <Skeleton key={i} height={140} radius={12} width={cardWidth} />
              ))}
            </View>
          ) : isError ? (
            <Empty title="Couldn't load checkpoints" body="Refresh and try again." />
          ) : !checkpoints || checkpoints.length === 0 ? (
            <Empty
              title="None set up yet"
              body="No checkpoints exist for your campus. Wave will add them before the first run."
            />
          ) : (
            <View className="flex-row flex-wrap" style={{ gap: 16 }}>
              {checkpoints.map((cp) => (
                <View
                  key={cp.id}
                  className="rounded-card bg-surface p-5"
                  style={{ width: cardWidth, maxWidth: "100%" }}
                >
                  <View className="mb-4 h-10 w-10 items-center justify-center rounded-pill bg-canvas">
                    <PinIcon size={20} color={colors.ink} strokeWidth={1.7} />
                  </View>
                  <Text className="font-sans-semibold text-ui text-ink">{cp.name}</Text>
                  {cp.description ? (
                    <Text className="mt-1 font-sans text-body text-muted">{cp.description}</Text>
                  ) : (
                    <Text className="mt-1 font-sans text-body text-muted">Campus drop-off</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
