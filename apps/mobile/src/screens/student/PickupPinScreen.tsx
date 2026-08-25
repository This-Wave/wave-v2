import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { useDeliveryPin, useOrder, useResendPin } from "../../lib/orders";
import { shortOrderRef } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "PickupPin">;

/**
 * Shows the six-digit delivery code in-app (and can re-text it).
 *
 * Rider verification still uses a bcrypt hash server-side. The app reads an
 * encrypted copy via `GET /orders/:id/delivery-pin` — only the owning student.
 */
export function PickupPinScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const { data: pin, isLoading, isError, refetch } = useDeliveryPin(params.orderId);
  const resend = useResendPin();
  const [note, setNote] = useState<string | null>(null);

  async function handleResend() {
    setNote(null);
    try {
      const result = await resend.mutateAsync(params.orderId);
      setNote(
        result.sent
          ? "Sent. Check your messages — the code above is the same one."
          : "Updated the code above. SMS could not send; use the digits here.",
      );
    } catch (err) {
      setNote(errorMessage(err) ?? "Could not send right now. Try again shortly.");
    }
  }

  return (
    <Screen narrow>
      <TopBar title={shortOrderRef(params.orderId)} onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-4">
          <Text className="mb-2 font-sans-bold text-heading text-ink">Your delivery code</Text>
          <Text className="mb-8 font-sans text-body text-muted">
            Read this out to your runner at {order?.checkpoint?.name ?? "your checkpoint"} — they
            type it in to close the delivery. We also text it to your phone.
          </Text>

          <View className="mb-6 items-center rounded-card bg-surface px-5 py-8">
            {isLoading ? (
              <Text className="font-sans text-body text-muted">Loading code…</Text>
            ) : isError || !pin ? (
              <View className="items-center">
                <Text className="mb-3 text-center font-sans text-body text-muted">
                  Couldn’t load your code.
                </Text>
                <Button label="Try again" variant="ghost" full={false} onPress={() => void refetch()} />
              </View>
            ) : (
              <Text
                className="font-sans-bold text-ink"
                style={{ fontSize: 40, letterSpacing: 10 }}
                accessibilityLabel={`Delivery code ${pin.split("").join(" ")}`}
              >
                {pin}
              </Text>
            )}
          </View>

          <View className="rounded-card bg-surface p-5">
            <Text className="mb-1 font-sans-semibold text-meta text-muted">DIDN'T GET THE TEXT?</Text>
            <Text className="font-sans text-body text-ink">
              Use the code above — it works without the SMS. You can also send it again to the
              number on your account. One text per minute.
            </Text>
          </View>

          {note ? <Text className="mt-4 font-sans text-body text-ink">{note}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Send the code again"
          onPress={handleResend}
          loading={resend.isPending}
          variant="primary"
        />
      </ActionBar>
    </Screen>
  );
}

function errorMessage(err: unknown): string | null {
  const maybe = err as { response?: { data?: { error?: string } } };
  return maybe?.response?.data?.error ?? null;
}
