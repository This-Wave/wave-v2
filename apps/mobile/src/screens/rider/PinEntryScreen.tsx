import { useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { CodeInput } from "../../components/ui/CodeInput";
import { Button } from "../../components/ui/Button";
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
      <View className="flex-1 px-6 pt-4">
        <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} />

        <View className="mt-7 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-success-bg">
            <ShieldCheck size={30} color="#009933" strokeWidth={1.6} />
          </View>
          <Text className="mb-1.5 font-sans-extrabold text-[20px] tracking-tight text-ink">Confirm Delivery</Text>
          <Text className="mb-7 text-center text-[13px] leading-5 text-muted">
            Enter PIN from{" "}
            <Text className="font-sans-bold text-ink">{order?.student?.fullName ?? "the student"}</Text>
            {"\n"}
            {order?.checkpoint?.name ?? "Checkpoint"}
          </Text>
        </View>

        <CodeInput value={pin} onChangeText={setPin} state={error ? "error" : "default"} />
        {error ? (
          <View className="mt-3 rounded-well border border-danger-border bg-danger-bg p-3">
            <Text className="text-center text-[12px] text-danger-text">{error}</Text>
          </View>
        ) : null}

        <View className="mb-auto" />
        <View className="pb-6">
          <Button
            label={error ? "Try Again" : "Confirm Delivery"}
            onPress={handleConfirm}
            loading={deliverOrder.isPending}
            disabled={pin.length < 6}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
