import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody } from "../../components/v6";
import { AlertIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { shortOrderRef } from "./orderPresenters";
import { resetStudentTabs, resetToPayment } from "../../lib/navigationFlows";

type Route = RouteProp<StudentStackParamList, "PaymentFailed">;

/**
 * Reached when the app could not confirm a payment.
 *
 * The copy is deliberately uncertain, because the situation is: the student may
 * have abandoned checkout, or the Paystack webhook may simply not have landed
 * yet. Claiming "payment failed" outright would be a lie in the second case,
 * and a student who was in fact charged would read it as money lost.
 */
export function PaymentFailedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();

  return (
    <Screen narrow>
      <ScreenBody bottomInset={16}>
        <Gutter className="pt-12">
          <View className="mb-6 h-14 w-14 items-center justify-center rounded-pill bg-hairline">
            <AlertIcon size={26} color={colors.ink} strokeWidth={1.8} />
          </View>

          <Text className="mb-2 font-sans-bold text-heading text-ink">
            We couldn't confirm that
          </Text>
          <Text className="mb-8 font-sans text-body text-muted">
            Your order {shortOrderRef(params.orderId)} is still waiting to be paid for. If money
            already left your account, it will settle shortly and the order will move on by itself —
            check back in a few minutes before paying again.
          </Text>

          <View className="rounded-card bg-surface p-5">
            <Text className="mb-1 font-sans-semibold text-meta text-muted">NOTHING IS LOST</Text>
            <Text className="font-sans text-body text-ink">
              The order is saved exactly as you built it. You can pay for it from your orders list
              at any time before the run.
            </Text>
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-2">
          <Button
            label="Try paying again"
            onPress={() =>
              resetToPayment(navigation, {
                orderId: params.orderId,
                totalAmount: params.totalAmount,
              })
            }
          />
          <Button
            label="Check my orders"
            variant="quiet"
            onPress={() => resetStudentTabs(navigation, "Orders")}
          />
        </View>
      </ActionBar>
    </Screen>
  );
}
