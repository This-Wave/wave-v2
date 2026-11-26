import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { CodeTicket } from "../../components/v7/Signature";
import { useDeliveryPin, useOrder, useResendPin } from "../../lib/orders";
import { apiErrorMessage } from "../../lib/apiError";
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
      setNote(apiErrorMessage(err, "Could not send right now. Try again shortly."));
    }
  }

  return (
    <Screen narrow>
      <TopBar title={shortOrderRef(params.orderId)} onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-4" style={{ gap: 16 }}>
          <Text accessibilityRole="header" className="font-display text-heading text-ink">Your code</Text>
          <Text className="font-sans text-ui text-muted">
            Show it at {order?.checkpoint?.name ?? "your pickup point"}. Only you can collect.
          </Text>
          {isError ? (
            <View className="items-center rounded-card bg-danger-bg p-5" style={{ gap: 10 }}>
              <Text className="text-center font-sans text-body text-danger">Couldn't load your code.</Text>
              <Button label="Try again" variant="ghost" full={false} onPress={() => void refetch()} />
            </View>
          ) : (
            <CodeTicket pin={isLoading ? null : (pin ?? null)} large note="Works without the SMS" />
          )}
          {note ? <Text className="font-sans text-body text-ink">{note}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Text me the code again"
          onPress={handleResend}
          loading={resend.isPending}
          variant="ghost"
        />
      </ActionBar>
    </Screen>
  );
}
