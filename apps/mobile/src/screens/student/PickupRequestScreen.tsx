import { useMemo, useState } from "react";
import { GuestAccountSheet } from "../../components/GuestAccountSheet";
import type { ResumeTarget } from "../../store/authStore";
import { Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  Field,
  Gutter,
  Screen,
  ScreenBody,
  Sheet,
  TopBar,
} from "../../components/v6";
import { CalendarIcon, CheckIcon, ChevronRightIcon, PinDotIcon, PinIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { pickupFeeFor, useCheckpoints } from "../../lib/checkpoints";
import { useCreateOrder } from "../../lib/orders";
import { useIsGuest, useViewerUniversityId } from "../../store/authStore";
import type { Checkpoint } from "../../types";
import { DEFAULT_DELIVERY_FEE_GHS, type PackageSize } from "@wave/shared";
import {
  deliveryDayFor,
  formatFullDay,
  formatGhs,
  isStandardRunDay,
  toApiDate,
  upcomingRunDays,
} from "../../lib/pricing";

/**
 * Package pickup: collect something from an Accra zone (or elsewhere on campus)
 * and bring it to a campus checkpoint.
 *
 * This used to be a dead form — `POST /orders` required a `shopId` and an order
 * carried only one checkpoint, so there was nothing to submit to. The
 * 20260807150000 migration made `shop_id` nullable and added
 * `origin_checkpoint_id`, so a pickup is now a real order that goes through the
 * same payment, dispatch and PIN handover as everything else.
 *
 * The one thing a pickup does differently: there is no item cost, so the
 * delivery fee is the whole price.
 */
type Route = RouteProp<StudentStackParamList, "PickupRequest">;

export function PickupRequestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const viewerUniversityId = useViewerUniversityId();
  const { data: checkpoints } = useCheckpoints(viewerUniversityId);

  const [description, setDescription] = useState(params?.description ?? "");
  const isGuest = useIsGuest();
  const [accountPrompt, setAccountPrompt] = useState<ResumeTarget | null>(null);
  const [fromId, setFromId] = useState<string | null>(params?.fromId ?? null);
  const [toId, setToId] = useState<string | null>(params?.toId ?? null);
  const [dayIndex, setDayIndex] = useState(0);
  const [picker, setPicker] = useState<"from" | "to" | "day" | "sender" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<PackageSize | null>(null);
  // The student is always the receiver, so the one person the rider needs is
  // whoever hands it over in Accra.
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [showRules, setShowRules] = useState(false);
  const createOrder = useCreateOrder();

  const chosenDate = params?.scheduledDate ? new Date(params.scheduledDate) : null;
  const days = useMemo(() => upcomingRunDays(new Date(), 4), []);
  const scheduled = chosenDate ?? days[dayIndex];
  const isSpecialOrder = params?.isSpecialOrder ?? (scheduled ? !isStandardRunDay(scheduled) : false);
  const zonePoints = (checkpoints ?? []).filter((c) => c.zone);
  const campusPoints = (checkpoints ?? []).filter((c) => !c.zone);
  const from = checkpoints?.find((c) => c.id === fromId) ?? zonePoints[0] ?? campusPoints[0];
  const to =
    campusPoints.find((c) => c.id === toId) ??
    campusPoints.find((c) => c.id !== from?.id) ??
    campusPoints[0];
  const fee = pickupFeeFor(from, DEFAULT_DELIVERY_FEE_GHS);
  const senderReady = senderName.trim().length >= 2 && senderPhone.replace(/\D/g, "").length >= 9;

  const ready =
    description.trim().length >= 3 && !!size && senderReady && !!from && !!to && from.id !== to.id && !!scheduled;

  async function handleContinue() {
    if (!from || !to || !scheduled) return;
    if (from.id === to.id) {
      setError("Pickup and drop-off have to be different places.");
      return;
    }
    setError(null);
    if (isGuest) {
      setAccountPrompt({
        route: "PickupRequest",
        params: { ...params, fromId: from.id, toId: to.id, description },
      });
      return;
    }
    try {
      const order = await createOrder.mutateAsync({
        orderType: "pickup",
        originCheckpointId: from.id,
        checkpointId: to.id,
        itemDescription: description.trim(),
        senderName: senderName.trim(),
        senderPhone: senderPhone.trim(),
        pickupNotes: pickupNotes.trim() || undefined,
        packageSize: size ?? undefined,
        deliveryDay: deliveryDayFor(scheduled, isSpecialOrder),
        scheduledDate: toApiDate(scheduled),
        isSpecialOrder,
      });
      navigation.replace("Payment", {
        orderId: order.id,
        totalAmount: Number(order.totalAmount),
      });
    } catch {
      setError("Couldn't create your delivery. Please try again.");
    }
  }

  return (
    <Screen narrow>
      <TopBar title="Send a package" onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text className="mb-5 font-sans text-body text-muted">
            Someone in Accra hands it over. We bring it to you on campus.
          </Text>

          {/* The route as one card, like a ride: pickup with its sender above,
              you below, joined by a line. */}
          <View className="mb-3 rounded-card border border-hairline bg-surface p-4">
            <PickerRow
              icon={<PinIcon size={18} color={colors.ink} strokeWidth={1.9} />}
              label="Pickup in Accra"
              value={from ? checkpointLabel(from) : undefined}
              placeholder="Choose a pickup area"
              onPress={() => setPicker("from")}
            />
            <Pressable
              onPress={() => setPicker("sender")}
              accessibilityRole="button"
              accessibilityLabel={senderReady ? `Sender ${senderName}, ${senderPhone}. Edit` : "Add sender details"}
              className="ml-11 mt-1 rounded-input py-1 active:bg-hairline"
            >
              {senderReady ? (
                <Text className="font-sans text-body text-muted" numberOfLines={1}>
                  {senderName.trim()} · {senderPhone.trim()}
                </Text>
              ) : (
                <Text className="font-sans-medium text-body text-ink underline">Add sender details</Text>
              )}
              {pickupNotes.trim() ? (
                <Text className="font-sans text-meta text-muted" numberOfLines={1}>
                  {pickupNotes.trim()}
                </Text>
              ) : null}
            </Pressable>
            <View className="my-1 ml-4 h-4 border-l border-dashed border-hairline" />
            <PickerRow
              icon={<PinDotIcon size={18} color={colors.ink} strokeWidth={1.9} />}
              label="You, at"
              value={to?.name}
              placeholder="Choose where you collect"
              onPress={() => setPicker("to")}
            />
          </View>

          <View className="mb-3 rounded-card border border-hairline bg-surface p-4">
            <Text className="mb-3 font-sans-medium text-ui text-ink">Package size</Text>
            <View className="gap-2" accessibilityRole="radiogroup">
              {SIZES.map((s) => (
                <Option
                  key={s.key}
                  title={s.title}
                  meta={s.meta}
                  selected={size === s.key}
                  onPress={() => setSize(s.key)}
                />
              ))}
            </View>
            <View className="mt-4">
              <Field
                label="What is it?"
                value={description}
                onChangeText={setDescription}
                placeholder="A black backpack with my laptop charger"
                multiline
                maxLength={500}
              />
            </View>
          </View>

          <View className="mb-3 rounded-card border border-hairline bg-surface p-4">
            <PickerRow
              icon={<CalendarIcon size={18} color={colors.ink} strokeWidth={1.9} />}
              label="Arrives on"
              value={scheduled ? formatFullDay(scheduled) : undefined}
              placeholder="Choose a day"
              onPress={chosenDate ? undefined : () => setPicker("day")}
            />
          </View>

          <View className="mb-3 rounded-card border border-hairline bg-surface p-4">
            <Text className="font-sans-medium text-ui text-ink">Your 6-digit code</Text>
            <Text className="mt-1 font-sans text-body text-muted">
              Only you can collect. We send the code when your order is confirmed.
            </Text>
          </View>

          <View className="rounded-card border border-hairline bg-surface p-4">
            <Pressable
              onPress={() => setShowRules((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showRules }}
              className="flex-row items-center justify-between"
            >
              <Text className="font-sans-medium text-ui text-ink">Before you send</Text>
              <Text className="font-sans-medium text-body text-ink underline">{showRules ? "Hide" : "Read"}</Text>
            </Pressable>
            {showRules ? (
              <View className="mt-3 gap-3">
                <Rule title="Ready to go" body="Sealed, labelled with your name, and ready when the rider arrives." />
                <Rule
                  title="We can't carry"
                  body="Cash, alcohol, medication, drugs, weapons, anything illegal, live animals, or anything you couldn't replace."
                />
                <Rule
                  title="If we can't collect"
                  body="If the sender can't be reached, we call you. The pickup can move to the next Wave."
                />
              </View>
            ) : null}
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        {error ? <Text className="mb-3 font-sans text-body text-danger">{error}</Text> : null}
        <Button
          label={`${isGuest ? "Continue" : "Confirm delivery"} · ${formatGhs(fee)}`}
          onPress={handleContinue}
          loading={createOrder.isPending}
          disabled={!ready}
        />
      </ActionBar>

      <Sheet
        visible={picker === "sender"}
        onClose={() => setPicker(null)}
        title="Who's sending it?"
        footer={<Button label="Save" disabled={!senderReady} onPress={() => setPicker(null)} />}
      >
        <View className="gap-4">
          <Field label="Sender's name" value={senderName} onChangeText={setSenderName} maxLength={80} autoFocus />
          <Field
            label="Sender's phone"
            value={senderPhone}
            onChangeText={setSenderPhone}
            keyboardType="phone-pad"
            maxLength={15}
            placeholder="024 123 4567"
            hint="The rider calls this number to collect."
          />
          <Field
            label="Where to meet them (optional)"
            value={pickupNotes}
            onChangeText={setPickupNotes}
            multiline
            maxLength={300}
            placeholder="Shell station by the Legon main gate"
          />
        </View>
      </Sheet>

      <Sheet
        visible={picker === "from" || picker === "to"}
        onClose={() => setPicker(null)}
        title={picker === "from" ? "Pickup in Accra" : "Where you collect"}
      >
        <View className="gap-1">
          {(picker === "from" ? zonePoints : campusPoints).map((c) => (
            <Option
              key={c.id}
              title={checkpointLabel(c)}
              meta={
                picker === "from"
                  ? formatGhs(pickupFeeFor(c, DEFAULT_DELIVERY_FEE_GHS))
                  : (c.description ?? undefined)
              }
              selected={(picker === "from" ? from?.id : to?.id) === c.id}
              onPress={() => {
                if (picker === "from") setFromId(c.id);
                else setToId(c.id);
                setPicker(null);
              }}
            />
          ))}
        </View>
      </Sheet>

      <Sheet visible={picker === "day"} onClose={() => setPicker(null)} title="Which day?">
        <View className="gap-1">
          {days.map((d, i) => (
            <Option
              key={i}
              title={formatFullDay(d)}
              selected={dayIndex === i}
              onPress={() => {
                setDayIndex(i);
                setPicker(null);
              }}
            />
          ))}
        </View>
      </Sheet>
      <GuestAccountSheet target={accountPrompt} onClose={() => setAccountPrompt(null)} />
    </Screen>
  );
}

/** Sizes guide the rider. The fee comes from the pickup zone, not the size. */
const SIZES: Array<{ key: PackageSize; title: string; meta: string }> = [
  { key: "ripple", title: "Ripple", meta: "Documents, phone, charger. Fits in a bag." },
  { key: "wave", title: "Wave", meta: "Clothes, shoes, a laptop. A shoebox or so." },
  { key: "swell", title: "Swell", meta: "Food trays, a small appliance. Carried in both arms." },
];

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <View>
      <Text className="font-sans-medium text-body text-ink">{title}</Text>
      <Text className="mt-0.5 font-sans text-body text-muted">{body}</Text>
    </View>
  );
}

/** "Zone A · Legon & East Legon" for a zone point, the plain name on campus. */
function checkpointLabel(c: Checkpoint): string {
  return c.zone ? `Zone ${c.zone.code} · ${c.name}` : c.name;
}

function Option({
  title,
  meta,
  selected,
  onPress,
}: {
  title: string;
  meta?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-3 rounded-card px-4 py-3.5 ${
        selected ? "bg-lime-faint" : "bg-canvas"
      }`}
    >
      <View className="flex-1">
        <Text className="font-sans-medium text-body text-ink">{title}</Text>
        {meta ? <Text className="font-sans text-body text-muted">{meta}</Text> : null}
      </View>
      {selected ? <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}

/**
 * One line of the route card: a glyph, what the line is for, and the choice.
 *
 * `Row` was close but wrong here — it is a list item with its own card
 * background, and three of them inside a card read as three cards. This is a
 * line inside one card, which is what makes the two ends of the route look
 * like a route.
 */
function PickerRow({
  icon,
  label,
  value,
  placeholder,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  placeholder: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}. ${value ?? placeholder}`}
      className="flex-row items-center gap-3 rounded-input py-1.5 active:bg-hairline"
    >
      <View className="h-8 w-8 items-center justify-center rounded-pill bg-lime-faint">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text className="font-sans text-meta text-muted">{label}</Text>
        <Text
          className={`font-sans-medium text-body ${value ? "text-ink" : "text-muted"}`}
          numberOfLines={1}
        >
          {value ?? placeholder}
        </Text>
      </View>
      {onPress ? <ChevronRightIcon size={18} color={colors.icon} strokeWidth={2} /> : null}
    </Pressable>
  );
}
