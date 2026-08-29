import { useState } from "react";
import { Text } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { CodeInput } from "../../components/ui/CodeInput";
import { useOrder } from "../../lib/orders";
import { useDeliverOrder } from "../../lib/rider";
import { resetRiderTabs } from "../../lib/navigationFlows";
import { showToast } from "../../store/toastStore";
import { apiErrorMessage } from "../../lib/apiError";

type Route = RouteProp<RiderStackParamList, "PinEntry">;

/**
 * The handover. The rider types the six digits the student reads out.
 *
 * This is the only way a delivery can be closed, and it is typed — there is no
 * scanner anywhere in Wave. The student's side used to imply otherwise with a
 * decorative barcode; that is gone, so the two screens now describe the same
 * mechanism.
 */
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
      showToast("Delivery complete.", "success");
      resetRiderTabs(navigation, "MyOrders");
    } catch (err) {
      // Use the API's own words. It now counts down the remaining tries and
      // explains the lockout ("ask the student to tap Resend PIN"), and a
      // hardcoded "that code doesn't match" would hide both — leaving a rider
      // retyping the same code against an order that has stopped answering.
      setError(
        apiErrorMessage(err, "That code doesn't match. Ask the student to read it again."),
      );
      setPin("");
    }
  }

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-2">
          <Text className="mb-2 font-sans-bold text-heading text-ink">Ask for the code</Text>
          <Text className="mb-10 font-sans text-body text-muted">
            {order?.student?.fullName ?? "The student"} has a six-digit code by text. Type it in to
            close this delivery at {order?.checkpoint?.name ?? "the checkpoint"}.
          </Text>

          <CodeInput value={pin} onChangeText={setPin} state={error ? "error" : "default"} />

          {error ? (
            <Text className="mt-4 text-center font-sans text-body text-danger">{error}</Text>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Confirm delivery"
          onPress={handleConfirm}
          loading={deliverOrder.isPending}
          disabled={pin.length < 6}
        />
      </ActionBar>
    </Screen>
  );
}
