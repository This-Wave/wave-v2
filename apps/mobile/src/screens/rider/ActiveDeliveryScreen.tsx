import { useMemo, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RiderStackParamList } from "../../navigation/RiderNavigator";
import {
  ActionBar,
  Button,
  Gutter,
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { PhoneIcon } from "../../components/icons";
import { parsePickupNotes } from "../../lib/pickupNotes";
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
  // A package pickup is collected from the sender: the first part of the
  // pickup notes is the address they gave, then the Accra zone.
  const origin = isShopPickup
    ? { name: order?.suggestion?.name, locationText: order?.suggestion?.locationText }
    : order?.orderType === "pickup"
      ? {
          name: order.senderName ?? order.originCheckpoint?.name,
          locationText: [order.pickupNotes?.split(" · ")[0], order.originCheckpoint?.name]
            .filter(Boolean)
            .join(", ") || undefined,
        }
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

  const d = parsePickupNotes(order?.pickupNotes);
  const address =
    order?.orderType === "pickup"
      ? [d.building, d.landmark ? d.landmark.charAt(0).toLowerCase() + d.landmark.slice(1) : null].filter(Boolean).join(", ") ||
        order.originCheckpoint?.name
      : origin.locationText;
  // Canvas progress: accepted, collected, at campus, handed over.
  const segment = step === "at_shop" ? 1 : 2;

  return (
    <Screen>
      <TopBar title="Active job" onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-1">
          <View className="mb-5 flex-row" style={{ gap: 6 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 4, now: segment }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} className={`h-1.5 flex-1 rounded-pill ${i < segment ? "bg-lime" : "bg-hairline"}`} />
            ))}
          </View>

          <Text accessibilityRole="header" className="font-display text-heading text-ink">
            {step === "at_shop" ? (isShopPickup || order?.orderType !== "pickup" ? "Go to the shop" : "Go to pickup") : "Go to campus"}
          </Text>
          <Text className="mb-5 mt-1 font-sans text-ui text-muted">
            {step === "at_shop" ? (address ?? "Pickup address on the way") : `${dropoff?.name ?? "The checkpoint"}${order?.checkpoint?.description ? `, ${order.checkpoint.description}` : ""}`}
          </Text>

          <View style={{ gap: 12 }}>
            {order?.senderName ? (
              <ContactCard
                name={order.senderName}
                meta={["Sender", d.handover].filter(Boolean).join(" · ")}
                phone={order.senderPhone}
              />
            ) : null}
            {order?.student ? (
              <ContactCard
                name={order.student.fullName}
                meta={`Receives at ${dropoff?.name ?? "the checkpoint"}`}
                phone={order.student.phone}
              />
            ) : null}
          </View>

          {d.instructions ? (
            <View className="mt-3 rounded-card bg-wash p-4">
              <Text className="font-sans-bold text-body text-ink">Instructions</Text>
              <Text className="mt-1 font-sans text-body text-ink-700">{d.instructions}</Text>
            </View>
          ) : null}

          {order?.packageSize || order?.itemDescription ? (
            <Text className="mt-3 font-sans text-body text-muted">
              {[order?.packageSize ? `${order.packageSize[0]!.toUpperCase()}${order.packageSize.slice(1)} size` : null, order?.itemDescription]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          ) : null}

          {order?.items?.length ? (
            <View className="mt-3 rounded-card border border-hairline bg-surface px-4">
              {order.items.map((item, i) => (
                <View key={item.id} className={`flex-row items-center justify-between py-3 ${i > 0 ? "border-t border-hairline" : ""}`}>
                  <Text className="flex-1 font-sans text-body text-ink">{item.quantity}× {item.name}</Text>
                  {item.unitPrice ? (
                    <Text className="font-sans text-body text-muted">{formatGhs(Number(item.unitPrice) * item.quantity)}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {isShopPickup ? (
            <View className="mt-3 rounded-card bg-warning-bg p-4">
              <Text className="font-sans-bold text-body text-warning">This shop isn't on Wave</Text>
              <Text className="mt-1 font-sans text-body text-warning">
                {costRecorded
                  ? goodsPaid
                    ? "The student has paid for the goods. You can complete the handover."
                    : "Waiting for the student to pay for the goods. You can't hand over until they do."
                  : "There are no prices on file. Buy the list, then record exactly what you paid. The student is charged that amount."}
              </Text>
            </View>
          ) : null}

          {/* Wave stores free text, not coordinates, for the pickup, so Maps
              opens on a search; the checkpoint uses its pin when an admin has
              set one. */}
          <View className="mt-4 self-start">
            <Text
              accessibilityRole="link"
              onPress={() =>
                step === "at_shop"
                  ? destination
                    ? openMapsSearch(destination)
                    : undefined
                  : dropoff
                    ? openCheckpointInMaps(dropoff)
                    : undefined
              }
              className="font-sans-bold text-ui text-link"
            >
              Open in Maps
            </Text>
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label={
            isShopPickup && !costRecorded
              ? "Record what you paid"
              : step === "at_shop"
                ? "I've collected it"
                : "I'm at the checkpoint"
          }
          onPress={handleAdvance}
          loading={updateStatus.isPending}
        />
      </ActionBar>
    </Screen>
  );
}

/** v7 canvas contact card: initial, name, role line, a square call key. */
function ContactCard({ name, meta, phone }: { name: string; meta: string; phone?: string | null }) {
  return (
    <View className="flex-row items-center rounded-card border border-hairline bg-surface p-4" style={{ gap: 12 }}>
      <View className="h-11 w-11 items-center justify-center rounded-pill bg-wash">
        <Text className="font-display text-ui text-ink">{name.trim()[0]?.toUpperCase()}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-ui text-ink" numberOfLines={1}>{name}</Text>
        <Text className="font-sans text-meta text-muted" numberOfLines={1}>{meta}</Text>
      </View>
      {phone ? (
        <Pressable
          onPress={() => void Linking.openURL(`tel:${phone}`)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${name}`}
          className="h-11 w-11 items-center justify-center rounded-input border-2 border-hairline bg-surface"
        >
          <PhoneIcon size={18} color={colors.ink} strokeWidth={1.9} />
        </Pressable>
      ) : null}
    </View>
  );
}
