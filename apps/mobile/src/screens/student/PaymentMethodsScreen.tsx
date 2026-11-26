import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { CardIcon, PhoneIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useAuthStore } from "../../store/authStore";
import { localPhone } from "../../components/v7/InfoRows";

/**
 * v7 canvas "Payment methods". Wave stores no card or wallet: MoMo is a prompt
 * to the number on the account (Moolre) and cards go through Paystack, so the
 * list shows how you can pay rather than saved instruments.
 */
export function PaymentMethodsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);

  const methods = [
    { key: "momo", title: "Mobile Money", meta: localPhone(profile?.phone) ?? "MTN · Telecel · AirtelTigo", badge: "Default", Icon: PhoneIcon },
    { key: "card", title: "Card", meta: "Visa or Mastercard, at checkout", badge: null, Icon: CardIcon },
  ];

  return (
    <Screen narrow>
      <TopBar title="Payment methods" onBack={() => navigation.goBack()} />
      <ScreenBody bottomInset={24}>
        <Gutter className="pt-2" style={{ gap: 12 }}>
          {methods.map(({ key, title, meta, badge, Icon }) => (
            <View
              key={key}
              className="flex-row items-center rounded-card border-2 border-line bg-surface px-4 py-3.5"
              style={{ gap: 12 }}
            >
              <Icon size={20} color={colors.ink} strokeWidth={1.9} />
              <View className="min-w-0 flex-1">
                <Text className="font-sans-bold text-ui text-ink">{title}</Text>
                <Text className="font-sans text-meta text-muted">{meta}</Text>
              </View>
              {badge ? <Text className="font-sans-bold text-meta text-ink-700">{badge}</Text> : null}
            </View>
          ))}
          <Text className="mt-1 font-sans text-meta text-muted">
            You choose each time you pay. Wave never stores your card or wallet.
          </Text>
        </Gutter>
      </ScreenBody>
    </Screen>
  );
}
