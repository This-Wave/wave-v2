import { useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { CodeInput } from "../../components/ui/CodeInput";
import { Button } from "../../components/ui/Button";
import { ChevronLeftIcon, ShieldCheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useOrder } from "../../lib/orders";
import { useDeliverOrder } from "../../lib/rider";

type Route = RouteProp<RiderStackParamList, "PinEntry">;

export function PinEntryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const deliverOrder = useDeliverOrder();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      await deliverOrder.mutateAsync({ orderId: params.orderId, pin });
      navigation.navigate("Tabs", { screen: "MyOrders" });
    } catch {
      setError("Incorrect PIN. Ask the student to check their code.");
      setPin("");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 px-5 pt-2">
        <IconButton onPress={() => navigation.goBack()}>
          <ChevronLeftIcon />
        </IconButton>

        <View className="mb-8 mt-9 items-center">
          <View className="mb-[18px] h-[72px] w-[72px] items-center justify-center rounded-full bg-wave-lime">
            <ShieldCheckIcon size={32} color={colors.primary} strokeWidth={1.6} />
          </View>
          <Text className="mb-2.5 font-sans-semibold text-[24px] tracking-tight text-ink">
            Confirm delivery
          </Text>
          <Text className="text-center text-[14px] leading-[22px] text-muted">
            Enter the PIN from{" "}
            <Text className="font-sans-semibold text-ink">{order?.student?.fullName ?? "the student"}</Text>
            {"\n"}
            {order?.checkpoint?.name ?? "Checkpoint"}
          </Text>
        </View>

        <CodeInput value={pin} onChangeText={setPin} state={error ? "error" : "default"} />

        {error ? (
          <View className="mt-3.5 rounded-control border border-danger-border bg-danger-bg p-3">
            <Text className="text-center text-[12px] text-danger-text">{error}</Text>
          </View>
        ) : (
          <Text className="mt-3.5 text-center text-[12px] text-muted">
            The student receives this PIN by SMS when payment succeeds.
          </Text>
        )}

        <View className="mb-auto" />
        <View className="pb-7">
          <Button
            label={error ? "Try again" : "Confirm delivery"}
            onPress={handleConfirm}
            loading={deliverOrder.isPending}
            disabled={pin.length < 6}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
