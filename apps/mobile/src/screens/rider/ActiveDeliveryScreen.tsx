import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CircleDot, MapPin } from "lucide-react-native";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { HorizontalStepper, type StepState } from "../../components/ui/HorizontalStepper";
import { useOrder } from "../../lib/orders";
import { useUpdateOrderStatus } from "../../lib/rider";
import { openMapsSearch } from "../../lib/maps";

type Route = RouteProp<RiderStackParamList, "ActiveDelivery">;

const LABELS = ["Accepted", "At Shop", "En Route", "Delivered"];

export function ActiveDeliveryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const updateStatus = useUpdateOrderStatus();
  const [step, setStep] = useState<"at_shop" | "en_route">("at_shop");

  const steps = useMemo(() => {
    const states: StepState[] =
      step === "at_shop" ? ["done", "active", "upcoming", "upcoming"] : ["done", "done", "active", "upcoming"];
    return LABELS.map((label, i) => ({ label, state: states[i] }));
  }, [step]);

  // Shops have no coordinates, only free text — so the map opens on a search.
  // Name and location together disambiguate ("Berekuso Fresh Mart" alone is not
  // a place a map knows). Empty when we have neither, which disables the button.
  const destination = useMemo(
    () => [order?.shop?.name, order?.shop?.locationText].filter(Boolean).join(", "),
    [order?.shop?.name, order?.shop?.locationText],
  );

  async function handleAdvance() {
    if (step === "at_shop") {
      await updateStatus.mutateAsync({ orderId: params.orderId, status: "en_route", note: "Picked up from shop" });
      setStep("en_route");
      return;
    }
    await updateStatus.mutateAsync({ orderId: params.orderId, status: "at_checkpoint", note: "Arrived at checkpoint" });
    navigation.navigate("PinEntry", { orderId: params.orderId });
  }

  const items = order?.itemDescription?.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="px-6 pb-3.5 pt-2">
        <Text className="mb-4 font-sans-extrabold text-[18px] tracking-tight text-ink">Active Delivery</Text>
        <HorizontalStepper steps={steps} />
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ gap: 12 }}>
        <Card>
          <View className="mb-2.5 flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="mb-1 font-sans-bold text-[13px] text-ink">{order?.shop?.name ?? "Shop"}</Text>
              <View className="flex-row items-center gap-1">
                <MapPin size={12} color="#6B7D63" />
                <Text className="text-[11px] text-muted" numberOfLines={1}>
                  {order?.shop?.locationText ?? "Off-campus"}
                </Text>
              </View>
            </View>
          </View>
          <Button
            label="Navigate"
            variant="secondary"
            disabled={!destination}
            onPress={() => openMapsSearch(destination)}
          />
        </Card>

        <Card>
          <Text className="mb-2.5 font-sans-semibold text-[11px] uppercase tracking-wider text-muted">Items</Text>
          {items.length === 0 ? (
            <Text className="text-[12px] text-muted">No items listed.</Text>
          ) : (
            items.map((item, i) => (
              <View key={i} className={`flex-row items-center gap-2 ${i > 0 ? "mt-2" : ""}`}>
                <CircleDot size={14} color="#009933" />
                <Text className="flex-1 text-[12px] text-ink">{item}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <View className="px-6 pb-6 pt-3">
        <Button
          label={step === "at_shop" ? "Mark as Collected · En Route" : "Arrived · Confirm Delivery"}
          onPress={handleAdvance}
          loading={updateStatus.isPending}
        />
      </View>
    </SafeAreaView>
  );
}
