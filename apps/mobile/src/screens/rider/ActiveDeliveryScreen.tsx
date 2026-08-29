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
import { openCheckpointInMaps, openMapsSearch } from "../../lib/maps";
import { apiErrorMessage } from "../../lib/apiError";
import { showToast } from "../../store/toastStore";
import { formatGhs } from "../../lib/pricing";

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

  const isShopPickup = order?.orderType === "shop_pickup";
  /**
   * Where the runner is going. A `shop_pickup` has no `Shop` row at all — the
   * place lives on the suggestion the student wrote — so reading only
   * `order.shop` would send them to an empty string.
   */
  const origin = isShopPickup
    ? { name: order?.suggestion?.name, locationText: order?.suggestion?.locationText }
    : { name: order?.shop?.name, locationText: order?.shop?.locationText };

  // Shops have no coordinates, only free text — so the map opens on a search.
  // Name and location together disambiguate; empty disables the button.
  // Captured out of `order` so the narrowing survives into the onPress closure.
  const dropoff = order?.checkpoint ?? null;

  const destination = useMemo(
    () => [origin.name, origin.locationText].filter(Boolean).join(", "),
    [origin.name, origin.locationText],
  );

  // The goods cost has been recorded once every line carries a price.
  const costRecorded = !!order?.items?.length && order.items.every((i) => i.actualUnitPrice !== null);
  const goodsPaid = !!order?.goodsPaidAt;

  const steps = [
    { label: "Order accepted", detail: "It's yours" },
    {
      label: `Collect from ${origin.name ?? "the shop"}`,
      detail: origin.locationText ?? undefined,
    },
    // Only a shop_pickup has this step: no menu on Wave means no price until
    // someone stands at the till and reports one.
    ...(isShopPickup
      ? [
          {
            label: "Record what you paid",
            detail: costRecorded
              ? goodsPaid
                ? "Student has paid"
                : "Waiting for the student to pay"
              : "Before you hand anything over",
          },
        ]
      : []),
    {
      label: `Carry to ${order?.checkpoint?.name ?? "the checkpoint"}`,
      detail: step === "en_route" ? "On the way" : "Not yet",
    },
    { label: "Take the student's PIN", detail: "Closes the delivery" },
  ];

  async function handleAdvance() {
    // A shop_pickup cannot leave the shop as "picked up" until the till total
    // is on record — after this the runner has no reason to still be there.
    if (isShopPickup && !costRecorded) {
      navigation.navigate("RecordGoodsCost", { orderId: params.orderId });
      return;
    }
    // Both transitions advance local state or navigate on success. Without a
    // catch, a failed call left `step` unchanged and no message shown — so a
    // rider on a patchy campus connection taps "I've picked it up", sees
    // nothing move, and has no way to tell whether it worked (review
    // 08-mobile, H4). `setStep` stays *after* the await deliberately: local
    // state must not claim a transition the server rejected.
    try {
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
    } catch (err) {
      showToast(apiErrorMessage(err, "Couldn't update — check your connection."), "danger");
    }
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
            {order?.items?.length ? (
              order.items.map((item, i) => (
                <View
                  key={item.id}
                  className={`flex-row items-center justify-between py-2 ${
                    i > 0 ? "border-t border-hairline" : ""
                  }`}
                >
                  <Text className="flex-1 font-sans text-body text-ink">
                    {item.quantity}× {item.name}
                  </Text>
                  {item.unitPrice ? (
                    <Text className="font-sans text-body text-muted">
                      {formatGhs(Number(item.unitPrice) * item.quantity)}
                    </Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text className="font-sans text-body text-ink">{order?.itemDescription ?? "—"}</Text>
            )}
          </View>

          {isShopPickup ? (
            <View className="mb-7 rounded-card bg-warning-bg p-4">
              <Text className="font-sans-medium text-body text-warning">
                This shop isn't on Wave
              </Text>
              <Text className="mt-1 font-sans text-body text-warning">
                {costRecorded
                  ? goodsPaid
                    ? "The student has paid for the goods. You can complete the handover."
                    : "Waiting for the student to pay for the goods. You can't hand over until they do."
                  : "There are no prices on file. Buy the list, then record exactly what you paid — the student is charged that amount."}
              </Text>
            </View>
          ) : null}

          {/* Wave stores a free-text `locationText`, never coordinates, so
              tapping this runs a map *search* rather than dropping a pin
              (see lib/maps.ts). Said plainly here so a rider expecting
              turn-by-turn to an exact spot isn't misled into trusting it
              (review 04-ux-design, M3). */}
          <RowGroup>
            <Row
              title={origin.name ?? "Shop"}
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
            {/* The drop-off had no navigation at all — the rider could open the
                shop in maps but not the checkpoint they were carrying to
                (review 11-campus, H3). Uses the recorded coordinates when an
                admin has entered them, and falls back to a name search when not,
                which is still most checkpoints today. */}
            {dropoff ? (
              <Row
                title={dropoff.name}
                meta={
                  dropoff.latitude && dropoff.longitude
                    ? "Drop-off — tap for directions"
                    : "Drop-off — tap to search the map"
                }
                onPress={() => openCheckpointInMaps(dropoff)}
              />
            ) : null}
          </RowGroup>

          {destination ? (
            <Text className="mt-3 font-sans text-meta text-muted">
              Tapping the shop searches your map app for that area — Wave has no exact pin.
              Ask around when you get close.
            </Text>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label={
            isShopPickup && !costRecorded
              ? "Record what you paid"
              : step === "at_shop"
                ? "I've picked it up"
                : "I'm at the checkpoint"
          }
          onPress={handleAdvance}
          loading={updateStatus.isPending}
        />
      </ActionBar>
    </Screen>
  );
}
