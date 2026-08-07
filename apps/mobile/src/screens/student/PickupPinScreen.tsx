import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { useOrder, useResendPin } from "../../lib/orders";
import { shortOrderRef } from "./orderPresenters";

type Route = RouteProp<StudentStackParamList, "PickupPin">;

/**
 * Pickup code, rebuilt around what is actually true.
 *
 * v5's version instructed the student to "show this code to your runner" and
 * then displayed six masked dots, because the PIN is bcrypt-hashed server-side
 * and only ever sent by SMS — there was nothing to show. Beneath that sat a
 * barcode its own component called decorative, implying a scan the runner
 * cannot perform: the rider app takes the PIN through a keypad.
 *
 * So both fictions are gone. This screen now does the two honest things: it
 * says where the code is, and it can send it again. `POST /orders/:id/resend-pin`
 * has existed since Phase 3 and had no caller in the app until now — which
 * meant a student whose SMS never arrived had no recovery path at all.
 */
export function PickupPinScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const { data: order } = useOrder(params.orderId);
  const resend = useResendPin();
  const [note, setNote] = useState<string | null>(null);

  async function handleResend() {
    setNote(null);
    try {
      await resend.mutateAsync(params.orderId);
      setNote("Sent. Check your messages.");
    } catch (err) {
      // The 429 carries the remaining cooldown in its message — show it as-is
      // rather than inventing a generic failure line.
      setNote(errorMessage(err) ?? "Could not send right now. Try again shortly.");
    }
  }

  return (
    <Screen>
      <TopBar title={shortOrderRef(params.orderId)} onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-4">
          <Text className="mb-2 font-sans-bold text-heading text-ink">Your delivery code</Text>
          <Text className="mb-8 font-sans text-body text-muted">
            We texted a six-digit code to your phone. Read it out to your runner at{" "}
            {order?.checkpoint?.name ?? "your checkpoint"} — they type it in to close the delivery.
          </Text>

          <View className="mb-6 rounded-card bg-surface p-5">
            <Text className="mb-1 font-sans-semibold text-meta text-muted">WHY IT ISN'T SHOWN HERE</Text>
            <Text className="font-sans text-body text-ink">
              Wave never stores your code in readable form — only a one-way hash. That means nobody
              at Wave can look it up, and neither can this app.
            </Text>
          </View>

          <View className="rounded-card bg-surface p-5">
            <Text className="mb-1 font-sans-semibold text-meta text-muted">DIDN'T GET THE TEXT?</Text>
            <Text className="font-sans text-body text-ink">
              We can send it again to the number on your account. One send per minute.
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
