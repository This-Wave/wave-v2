import { SafeAreaView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Barcode, PinDisplay } from "../../components/ui/PinDisplay";
import { useOrder } from "../../lib/orders";
import { shortOrderRef } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "PickupPin">;

/**
 * v5 screen 11 "Pickup code". The PIN itself is bcrypt-hashed server-side and
 * only ever delivered to the student by SMS — it is never returned by the API,
 * so this screen shows the placeholder cells plus the order reference the runner
 * scans, and points at the SMS for the digits.
 */
export function PickupPinScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);

  const reference = `${shortOrderRef(params.orderId).replace("#", "")}-${params.orderId
    .replace(/[^0-9]/g, "")
    .slice(0, 6)
    .padEnd(6, "0")}`;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Pickup code" onBack={() => navigation.goBack()} />

      <View className="flex-1 items-center justify-center px-7">
        <Text className="mb-6 text-center text-[14px] leading-[21px] text-muted">
          Show this code to your runner to confirm handoff at {order?.checkpoint?.name ?? "your checkpoint"}
        </Text>

        <View className="mb-7">
          <PinDisplay pin="••••••" highlightIndex={3} />
        </View>

        <Text className="mb-7 text-center text-[13px] leading-5 text-muted">
          Your six-digit PIN was sent to your phone by SMS. Wave never stores it in readable form.
        </Text>

        <Barcode label={reference} />
      </View>
    </SafeAreaView>
  );
}
