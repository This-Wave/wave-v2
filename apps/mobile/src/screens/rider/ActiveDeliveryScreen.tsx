import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { Button } from "../../components/ui/Button";
import { FieldLabel } from "../../components/ui/FieldLabel";
import { HorizontalStepper, type StepState } from "../../components/ui/HorizontalStepper";
import { NavigateIcon, PinIcon } from "../../components/icons";
import { colors, shadowCard } from "../../theme/tokens";
import { useOrder } from "../../lib/orders";
import { useUpdateOrderStatus } from "../../lib/rider";

type Route = RouteProp<RiderStackParamList, "ActiveDelivery">;

const LABELS = ["Accepted", "At shop", "En route", "Delivered"];

export function ActiveDeliveryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const updateStatus = useUpdateOrderStatus();
  const [step, setStep] = useState<"at_shop" | "en_route">("at_shop");

  const steps = useMemo(() => {
    const states: StepState[] =
      step === "at_shop"
        ? ["done", "active", "upcoming", "upcoming"]
        : ["done", "done", "active", "upcoming"];
    return LABELS.map((label, i) => ({ label, state: states[i] }));
  }, [step]);

  async function handleAdvance() {
    if (step === "at_shop") {
      await updateStatus.mutateAsync({
        orderId: params.orderId,
        status: "en_route",
        note: "Picked up from shop",
      });
      setStep("en_route");
      return;
    }
    await updateStatus.mutateAsync({
      orderId: params.orderId,
      status: "at_checkpoint",
      note: "Arrived at checkpoint",
    });
    navigation.navigate("PinEntry", { orderId: params.orderId });
  }

  const items =
    order?.itemDescription
      ?.split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="px-5 pb-4 pt-2">
        <Text className="mb-5 font-sans-semibold text-[18px] tracking-tight text-ink">
          Active delivery
        </Text>
        <HorizontalStepper steps={steps} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }}>
        <View className="rounded-card border border-border bg-surface p-[18px]" style={shadowCard}>
          <View className="mb-4">
            <Text className="font-sans-semibold text-[15px] text-ink">{order?.shop?.name ?? "Shop"}</Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <PinIcon size={12} color={colors.muted} strokeWidth={1.8} />
              <Text className="flex-1 text-[11px] text-muted" numberOfLines={1}>
                {order?.shop?.locationText ?? "Off-campus"}
              </Text>
            </View>
          </View>
          <Button
            label="Navigate"
            variant="secondary"
            icon={<NavigateIcon size={15} color={colors.ink} />}
            onPress={() => {}}
          />
        </View>

        <View className="rounded-card border border-border bg-surface p-[18px]" style={shadowCard}>
          <FieldLabel>Items</FieldLabel>
          {items.length === 0 ? (
            <Text className="text-[13px] text-muted">No items listed.</Text>
          ) : (
            items.map((item, i) => (
              <View key={i} className={`flex-row items-center gap-2.5 ${i > 0 ? "mt-3" : ""}`}>
                <View className="h-[15px] w-[15px] items-center justify-center rounded-full border-[1.7px] border-wave-500">
                  <View className="h-[5px] w-[5px] rounded-full bg-wave-500" />
                </View>
                <Text className="flex-1 text-[14px] text-ink">{item}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View className="px-5 pb-7 pt-3">
        <Button
          label={step === "at_shop" ? "Mark as collected · En route" : "Arrived · Confirm delivery"}
          onPress={handleAdvance}
          loading={updateStatus.isPending}
        />
      </View>
    </SafeAreaView>
  );
}
