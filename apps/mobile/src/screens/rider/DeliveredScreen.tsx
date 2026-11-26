import { Text } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody } from "../../components/v6";
import { Illustration, Rise } from "../../components/v7/Illustration";
import { formatGhsCompact } from "../../lib/pricing";
import { resetRiderTabs } from "../../lib/navigationFlows";

type Route = RouteProp<RiderStackParamList, "Delivered">;

/** v7 canvas "Delivered": the handover is done; show what it earned. */
export function DeliveredScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { params } = useRoute<Route>();

  return (
    <Screen narrow>
      <ScreenBody bottomInset={16}>
        <Gutter className="items-center pt-16" style={{ gap: 12 }}>
          <Rise>
            <Illustration name="run" width={240} height={180} />
          </Rise>
          <Rise delay={80}>
            <Text accessibilityRole="header" className="text-center font-display text-heading text-ink">
              Delivered
            </Text>
          </Rise>
          <Rise delay={140}>
            <Text className="text-center font-sans text-ui text-muted">Nice one. Added to this week.</Text>
          </Rise>
          {params.earned != null ? (
            <Rise delay={200}>
              <Text className="mt-2 font-display text-ink" style={{ fontSize: 48, lineHeight: 52 }}>
                +{formatGhsCompact(params.earned)}
              </Text>
            </Rise>
          ) : null}
        </Gutter>
      </ScreenBody>
      <ActionBar>
        <Button label="Next job" onPress={() => resetRiderTabs(navigation, "Feed")} />
      </ActionBar>
    </Screen>
  );
}
