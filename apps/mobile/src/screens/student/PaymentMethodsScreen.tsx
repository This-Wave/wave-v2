import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { SelectRow } from "../../components/ui/SelectRow";
import { CardIcon, CashIcon, MobileIcon, PlusIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useAuthStore } from "../../store/authStore";

/**
 * v5 screen 15 "Payment methods". Wave doesn't vault instruments — Paystack
 * owns that — so these rows record a *preferred* channel, and the dashed
 * "Add payment method" affordance routes to the card form (screen 16).
 */
export function PaymentMethodsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const [selected, setSelected] = useState(0);

  const methods = [
    { label: "Mobile Money", subtitle: profile?.phone ?? "Your MoMo wallet", icon: <MobileIcon /> },
    {
      label: "Card",
      subtitle: "Visa or Mastercard",
      icon: <CardIcon size={18} color={colors.ink} strokeWidth={1.6} />,
    },
    { label: "Cash on delivery", subtitle: "Pay your runner directly", icon: <CashIcon /> },
  ];

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Payment methods" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="gap-3">
          {methods.map((method, index) => (
            <SelectRow
              key={method.label}
              title={method.label}
              subtitle={method.subtitle}
              selected={selected === index}
              onPress={() => setSelected(index)}
              leading={<View className="h-10 w-10 items-center justify-center rounded-control bg-canvas">{method.icon}</View>}
            />
          ))}
        </View>

        <Pressable
          className="mt-5 h-[52px] flex-row items-center justify-center gap-2 rounded-control border border-dashed border-wave-500"
          onPress={() => navigation.navigate("AddCard")}
        >
          <PlusIcon />
          <Text className="font-sans-semibold text-[14px] text-wave-500">Add payment method</Text>
        </Pressable>

        <Text className="mt-4 text-center text-[12px] leading-[18px] text-muted">
          Card details are never stored by Wave — every charge runs through Paystack&apos;s hosted checkout.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
