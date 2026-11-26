import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BoxIcon, CheckIcon, HomeIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { usePickupPointStore } from "../../store/pickupPointStore";
import {
  Empty,
  Gutter,
  PageTitle,
  Screen,
  ScreenBody,
  Skeleton,
  TopBar,
} from "../../components/v6";
import { useDropoffPoints } from "../../lib/checkpoints";
import { useViewerUniversityId } from "../../store/authStore";
import { useLayout } from "../../hooks/useLayout";
import { StudentCheckpointsWeb } from "./web/StudentCheckpointsWeb";

/**
 * The checkpoints Wave hands over at, read-only.
 * Web uses a card grid; native keeps the phone list.
 */
export function CheckpointsScreen() {
  const { isDesktop } = useLayout();
  if (isDesktop) return <StudentCheckpointsWeb />;
  return <CheckpointsMobile />;
}

function CheckpointsMobile() {
  const navigation = useNavigation();
  const universityId = useViewerUniversityId();
  const { data: raw, isLoading, isError } = useDropoffPoints(universityId ?? undefined);
  // The main campus point leads, then the rest as the API orders them.
  const checkpoints = raw ? [...raw].sort((a, b) => Number(isMain(b.name)) - Number(isMain(a.name))) : raw;
  const defaultId = usePickupPointStore((st) => st.defaultId);
  const setDefault = usePickupPointStore((st) => st.setDefault);
  const chosen = defaultId ?? checkpoints?.[0]?.id ?? null;

  return (
    <Screen>
      {navigation.canGoBack() ? <TopBar onBack={() => navigation.goBack()} /> : null}
      <ScreenBody bottomInset={24}>
        <Gutter className="pb-2 pt-4">
          <PageTitle>Pickup points</PageTitle>
          <Text className="mb-5 mt-2 font-sans text-ui text-muted">Where your parcels arrive at Ashesi.</Text>
        </Gutter>

        <Gutter>
          {isLoading ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={72} radius={14} />
              <Skeleton height={72} radius={14} />
              <Skeleton height={72} radius={14} />
            </View>
          ) : isError ? (
            <Empty title="Couldn't load pickup points" body="Go back and try again." />
          ) : !checkpoints || checkpoints.length === 0 ? (
            <Empty title="None set up yet" body="Wave will add them before the first run." />
          ) : (
            <View style={{ gap: 12 }}>
              {checkpoints.map((cp) => {
                const on = cp.id === chosen;
                return (
                  <Pressable
                    key={cp.id}
                    onPress={() => setDefault(cp.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${cp.name}${cp.description ? `, ${cp.description}` : ""}`}
                    className={`flex-row items-center rounded-card border-2 px-4 py-3.5 ${on ? "border-ink bg-wash" : "border-line bg-surface"}`}
                    style={{ gap: 12 }}
                  >
                    {isMain(cp.name) ? (
                      <HomeIcon size={20} color={colors.ink} strokeWidth={1.9} />
                    ) : (
                      <BoxIcon size={20} color={colors.ink} strokeWidth={1.9} />
                    )}
                    <View className="min-w-0 flex-1">
                      <Text className="font-sans-bold text-ui text-ink">{cp.name}</Text>
                      {cp.description ? (
                        <Text className="font-sans text-meta text-muted" numberOfLines={2}>{cp.description}</Text>
                      ) : null}
                    </View>
                    {on ? <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} /> : null}
                  </Pressable>
                );
              })}
              <Text className="font-sans text-meta text-muted">
                Your default is used for every order. Change it any time.
              </Text>
            </View>
          )}
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}

function isMain(name: string): boolean {
  return /^on campus/i.test(name.trim());
}
