import { Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { BoxIcon, CartIcon, ChevronRightIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { formatFullDay } from "../../lib/pricing";
import { DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT } from "@wave/shared";

type Nav = NativeStackNavigationProp<StudentStackParamList>;
type Route = RouteProp<StudentStackParamList, "ChooseService">;

/**
 * The second question: what kind of run is this?
 *
 * Both options are full-width rows rather than the two side-by-side tiles Home
 * uses. On Home they compete with a shop browser and have to be compact; here
 * they are the entire screen, and the extra width buys room to say what each
 * one actually does — which is the difference between a student picking the
 * right one and picking the first one.
 */
export function ChooseServiceScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const date = new Date(params.scheduledDate);

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={32}>
        <Gutter>
          <Text className="mb-2 font-sans-bold text-heading text-ink">What do you need?</Text>
          <Text className="mb-8 font-sans text-body text-muted">
            For {formatFullDay(date)}
            {params.isSpecialOrder
              ? ` · rush order, +${DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}% delivery`
              : ""}
            .
          </Text>

          <ServiceRow
            icon={<CartIcon size={22} color={colors.ink} strokeWidth={1.7} />}
            title="Buy for me"
            body="Pick items from a shop's menu and we'll buy them and bring them to your checkpoint."
            onPress={() =>
              navigation.navigate("ShopSelection", {
                scheduledDate: params.scheduledDate,
                isSpecialOrder: params.isSpecialOrder,
              })
            }
          />

          <ServiceRow
            icon={<BoxIcon size={22} color={colors.ink} strokeWidth={1.7} />}
            title="Pickup"
            body="Already have the thing? We'll move it from one campus checkpoint to another. You pay the delivery fee only."
            onPress={() =>
              navigation.navigate("PickupRequest", {
                scheduledDate: params.scheduledDate,
                isSpecialOrder: params.isSpecialOrder,
              })
            }
          />
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}

function ServiceRow({
  icon,
  title,
  body,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      className="mb-3 flex-row items-center gap-4 rounded-card bg-surface p-5 active:bg-hairline"
    >
      <View className="h-11 w-11 items-center justify-center rounded-pill bg-lime-faint">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="mb-1 font-sans-medium text-subheading text-ink">{title}</Text>
        <Text className="font-sans text-body text-muted">{body}</Text>
      </View>
      <ChevronRightIcon size={16} color={colors.subtle} />
    </Pressable>
  );
}
