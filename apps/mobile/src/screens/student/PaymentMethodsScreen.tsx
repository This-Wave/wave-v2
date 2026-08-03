import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Card } from "../../components/ui/Card";
import { CardIcon, MobileIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";

/**
 * v5 screen 15 "Payment methods".
 *
 * Informational on purpose. Wave does not vault payment instruments — Paystack
 * owns that — and there is nowhere to store a preferred channel either, so this
 * screen tells the student what they can pay with and where the choice happens.
 *
 * It previously offered a selectable list including **Cash on delivery**, plus an
 * "Add payment method" button leading to a card form. Both were fiction: the
 * selection was local state that nothing read, the card form saved nothing, and
 * checkout only ever supports `momo | card` through Paystack. A student could
 * reasonably have arrived at a checkpoint expecting to pay cash.
 */
export function PaymentMethodsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();

  const methods = [
    {
      label: "Mobile Money",
      subtitle: "MTN, Vodafone and AirtelTigo",
      icon: <MobileIcon />,
    },
    {
      label: "Card",
      subtitle: "Visa or Mastercard",
      icon: <CardIcon size={18} color={colors.ink} strokeWidth={1.6} />,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Payment methods" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <Text className="mb-4 text-[13px] leading-[19px] text-muted">
          You choose how to pay when you check out. Wave accepts:
        </Text>

        <View className="gap-3">
          {methods.map((method) => (
            <Card key={method.label} className="flex-row items-center gap-3 bg-surface">
              <View className="h-10 w-10 items-center justify-center rounded-control bg-canvas">{method.icon}</View>
              <View className="flex-1">
                <Text className="font-sans-semibold text-[14px] text-ink">{method.label}</Text>
                <Text className="mt-0.5 text-[12px] text-muted">{method.subtitle}</Text>
              </View>
            </Card>
          ))}
        </View>

        <Text className="mt-5 text-center text-[12px] leading-[18px] text-muted">
          Your details are never stored by Wave — every charge runs through Paystack&apos;s hosted
          checkout, so there is nothing to add or remove here.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
