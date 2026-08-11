import { Text, View } from "react-native";
import {
  Empty,
  Gutter,
  PageTitle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Skeleton,
} from "../../components/v6";
import { useCheckpoints } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { useLayout } from "../../hooks/useLayout";
import { StudentCheckpointsWeb } from "./web/StudentCheckpointsWeb";

/**
 * The campus drop-off points, read-only.
 * Web uses a card grid; native keeps the phone list.
 */
export function CheckpointsScreen() {
  const { isDesktop } = useLayout();
  if (isDesktop) return <StudentCheckpointsWeb />;
  return <CheckpointsMobile />;
}

function CheckpointsMobile() {
  const universityId = useAuthStore((s) => s.profile?.universityId);
  const { data: checkpoints, isLoading, isError } = useCheckpoints(universityId ?? undefined);

  return (
    <Screen>
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-2 pt-4">
          <PageTitle>Checkpoints</PageTitle>
          <Text className="mb-7 mt-2 font-sans text-body text-muted">
            Your runner meets you at one of these. You choose which when you place an order.
          </Text>
        </Gutter>

        <Gutter>
          {isLoading ? (
            <View className="gap-2">
              <Skeleton height={68} radius={12} />
              <Skeleton height={68} radius={12} />
              <Skeleton height={68} radius={12} />
            </View>
          ) : isError ? (
            <Empty title="Couldn't load checkpoints" body="Go back and try again." />
          ) : !checkpoints || checkpoints.length === 0 ? (
            <Empty
              title="None set up yet"
              body="No checkpoints exist for your campus. Wave will add them before the first run."
            />
          ) : (
            <RowGroup>
              {checkpoints.map((cp) => (
                <Row
                  key={cp.id}
                  title={cp.name}
                  meta={cp.description ?? undefined}
                  chevron={false}
                />
              ))}
            </RowGroup>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
