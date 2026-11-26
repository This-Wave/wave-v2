import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody } from "../../components/v6";
import { Illustration, Rise } from "../../components/v7/Illustration";
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
        <Gutter className="items-center pt-12" style={{ gap: 14 }}>
          <Rise>
            <Illustration name="pillow" width={220} height={160} />
          </Rise>
          <Rise delay={80}>
            <Text accessibilityRole="header" className="text-center font-display text-heading text-ink">
              Payment didn't go through
            </Text>
          </Rise>
          <Rise delay={140}>
            <Text className="text-center font-sans text-ui text-muted" style={{ lineHeight: 24 }}>
              Your order {shortOrderRef(params.orderId)} is saved. If money left your account, it settles on its own in a few minutes.
            </Text>
          </Rise>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-2">
          <Button
            label="Try again"
            onPress={() =>
              resetToPayment(navigation, {
                orderId: params.orderId,
                totalAmount: params.totalAmount,
              })
            }
          />
          <Button
            label="Check my orders"
            variant="ghost"
            onPress={() => resetStudentTabs(navigation, "Orders")}
          />
        </View>
      </ActionBar>
    </Screen>
  );
}
