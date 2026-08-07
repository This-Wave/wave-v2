import { useMemo, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  ActionBar,
  Button,
  Gutter,
  IconCircle,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Steps,
  Thumb,
  TopBar,
} from "../../components/v6";
import { PhoneIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useOrder } from "../../lib/orders";
import { useUpdateOrderStatus } from "../../lib/rider";
import { openMapsSearch } from "../../lib/maps";

type Route = RouteProp<RiderStackParamList, "ActiveDelivery">;

/**
 * The delivery in progress.
 *
 * v5 used a horizontal four-dot stepper, which fits four words and no detail.
 * The vertical `Steps` list carries the same states plus what each one actually
 * involves, and it is the same component the student sees on their side — the
 * two views of one delivery now agree by construction.
 */
export function ActiveDeliveryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const updateStatus = useUpdateOrderStatus();
  const [step, setStep] = useState<"at_shop" | "en_route">("at_shop");

  // Shops have no coordinates, only free text — so the map opens on a search.
  // Name and location together disambiguate; empty disables the button.
  const destination = useMemo(
    () => [order?.shop?.name, order?.shop?.locationText].filter(Boolean).join(", "),
    [order?.shop?.name, order?.shop?.locationText],
  );

  const steps = [
    { label: "Order accepted", detail: "It's yours" },
    {
      label: `Collect from ${order?.shop?.name ?? "the shop"}`,
      detail: order?.shop?.locationText ?? undefined,
    },
    {
      label: `Carry to ${order?.checkpoint?.name ?? "the checkpoint"}`,
      detail: step === "en_route" ? "On the way" : "Not yet",
    },
    { label: "Take the student's PIN", detail: "Closes the delivery" },
  ];

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

  return (
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-2">
          <Text className="mb-8 font-sans-bold text-heading text-ink">
            {step === "at_shop" ? "Go and collect it" : "Take it to the checkpoint"}
          </Text>

          <View className="mb-7 rounded-card bg-surface p-5">
            <Steps steps={steps} currentIndex={step === "at_shop" ? 1 : 2} />
          </View>

          <Text className="mb-2 font-sans-medium text-body text-ink">What to buy</Text>
          <View className="mb-7 rounded-card bg-surface p-4">
            <Text className="font-sans text-body text-ink">{order?.itemDescription ?? "—"}</Text>
          </View>

          <RowGroup>
            <Row
              title={order?.shop?.name ?? "Shop"}
              meta={destination || "No location on file"}
              leading={<Thumb uri={order?.shop?.logoUrl} />}
              onPress={destination ? () => openMapsSearch(destination) : undefined}
            />
            {/* The student's number is legitimately needed now — the order is
                claimed and a handover has to be coordinated. */}
            {order?.student?.phone ? (
              <Row
                title={order.student.fullName}
                meta="Meeting you at the checkpoint"
                chevron={false}
                trailing={
                  <IconCircle
                    tone="lime"
                    accessibilityLabel={`Call ${order.student.fullName}`}
                    onPress={() => Linking.openURL(`tel:${order.student!.phone}`)}
                  >
                    <PhoneIcon size={18} color={colors.ink} strokeWidth={1.8} />
                  </IconCircle>
                }
              />
            ) : null}
          </RowGroup>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label={step === "at_shop" ? "I've picked it up" : "I'm at the checkpoint"}
          onPress={handleAdvance}
          loading={updateStatus.isPending}
        />
      </ActionBar>
    </Screen>
  );
}
