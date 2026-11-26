import { useState } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import { ActionBar, Button, CodeInput, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { Keypad } from "../../components/v7/Keypad";
import { useOrder } from "../../lib/orders";
import { useDeliverOrder } from "../../lib/rider";
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
      navigation.replace("Delivered", {
        orderId: params.orderId,
        earned: order?.estimatedEarning ? Number(order.estimatedEarning) : null,
      });
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

  const first = order?.student?.fullName?.trim().split(/\s+/)[0];

  return (
    <Screen narrow>
      <TopBar title="Hand over" onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-2">
          <Text accessibilityRole="header" className="mb-5 text-center font-display text-heading text-ink">
            {first ? `Enter ${first}'s code` : "Enter the code"}
          </Text>

          {/* The digits are a secret said beside other people: a screen reader
              hears how many are in, never which (see CodeInput). */}
          <View accessible accessibilityLabel={`${pin.length} of 6 digits entered`} accessibilityLiveRegion="polite">
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <CodeInput value={pin} editable={false} state={error ? "error" : "default"} />
            </View>
          </View>

          {error ? (
            <Text accessibilityLiveRegion="assertive" role="alert" className="mt-4 text-center font-sans text-body text-danger">
              {error}
            </Text>
          ) : null}

          <View className="mt-6">
            <Keypad
              onDigit={(d) => {
                setError(null);
                setPin((p) => (p.length < 6 ? p + d : p));
              }}
              onDelete={() => setPin((p) => p.slice(0, -1))}
            />
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Hand it over"
          onPress={handleConfirm}
          loading={deliverOrder.isPending}
          disabled={pin.length < 6}
        />
      </ActionBar>
    </Screen>
  );
}
