import { useMemo, useState } from "react";
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
import { useCheckpoints } from "../../lib/checkpoints";
import { useCreateOrder } from "../../lib/orders";
import { useAuthStore } from "../../store/authStore";
import { DEFAULT_DELIVERY_FEE_GHS } from "@wave/shared";
import {
  deliveryDayFor,
  formatFullDay,
  formatGhs,
  isStandardRunDay,
  toApiDate,
  upcomingRunDays,
} from "../../lib/pricing";

/**
 * Campus-to-campus package pickup: move something already on campus from one
 * checkpoint to another.
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
  const profile = useAuthStore((s) => s.profile);
  const { data: checkpoints } = useCheckpoints(profile?.universityId ?? undefined);

  const [description, setDescription] = useState("");
  // Pre-chosen when arriving from "Move it again"; both are still editable.
  const [fromId, setFromId] = useState<string | null>(params?.fromId ?? null);
  const [toId, setToId] = useState<string | null>(params?.toId ?? null);
  const [dayIndex, setDayIndex] = useState(0);
  const [picker, setPicker] = useState<"from" | "to" | "day" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createOrder = useCreateOrder();

  /**
   * A date chosen on the calendar wins outright and the day picker disappears —
   * asking twice would let the two answers disagree. Entering straight from
   * Home's Pickup tile keeps the old inline picker.
   */
  const chosenDate = params?.scheduledDate ? new Date(params.scheduledDate) : null;
  const days = useMemo(() => upcomingRunDays(new Date(), 4), []);
  const scheduled = chosenDate ?? days[dayIndex];
  const isSpecialOrder = params?.isSpecialOrder ?? (scheduled ? !isStandardRunDay(scheduled) : false);
  const from = checkpoints?.find((c) => c.id === fromId) ?? checkpoints?.[0];
  const to = checkpoints?.find((c) => c.id === toId) ?? checkpoints?.[1] ?? checkpoints?.[0];

  async function handleContinue() {
    if (!from || !to) return;
    if (from.id === to.id) {
      setError("Collection and drop-off have to be different checkpoints.");
      return;
    }
    if (!scheduled) return;
    setError(null);
    try {
      const order = await createOrder.mutateAsync({
        orderType: "pickup",
        originCheckpointId: from.id,
        checkpointId: to.id,
        itemDescription: description.trim(),
        deliveryDay: deliveryDayFor(scheduled, isSpecialOrder),
        scheduledDate: toApiDate(scheduled),
        isSpecialOrder,
      });
      navigation.replace("Payment", {
        orderId: order.id,
        totalAmount: Number(order.totalAmount),
      });
    } catch {
      setError("Couldn't create your pickup. Please try again.");
    }
  }

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text className="mb-1 font-sans-bold text-heading text-ink">Send a package</Text>
          <Text className="mb-6 font-sans text-body text-muted">
            Carried between campus checkpoints on the next Wave. The delivery fee is the whole
            price.
          </Text>

          {/* Pickup & delivery first: the route is the decision, and the two
              ends read as one thing when they sit in one card. */}
          <View className="mb-3 rounded-card bg-surface p-4">
            <Text className="mb-3 font-sans-medium text-ui text-ink">Pickup &amp; delivery</Text>
            <PickerRow
              icon={<PinIcon size={18} color={colors.ink} strokeWidth={1.9} />}
              label="Collect from"
              value={from?.name}
              placeholder="Choose a pickup point"
              onPress={() => setPicker("from")}
            />
            <View className="my-1 ml-4 h-4 border-l border-dashed border-hairline" />
            <PickerRow
              icon={<PinDotIcon size={18} color={colors.ink} strokeWidth={1.9} />}
              label="Deliver to"
              value={to?.name}
              placeholder="Choose a drop-off"
              onPress={() => setPicker("to")}
            />
            <View className="my-3 border-t border-hairline" />
            <PickerRow
              icon={<CalendarIcon size={18} color={colors.ink} strokeWidth={1.9} />}
              label={`Delivery fee ${formatGhs(DEFAULT_DELIVERY_FEE_GHS)}`}
              value={scheduled ? formatFullDay(scheduled) : undefined}
              placeholder="Choose a day"
              onPress={chosenDate ? undefined : () => setPicker("day")}
            />
          </View>

          <View className="rounded-card bg-surface p-4">
            <Field
              label="What are we moving?"
              value={description}
              onChangeText={setDescription}
              placeholder="Blue bag left with the security guard at the main gate."
              multiline
            />
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        {error ? (
          <Text className="mb-3 font-sans text-body text-danger">{error}</Text>
        ) : null}
        <Button
          label="Review pickup"
          onPress={handleContinue}
          loading={createOrder.isPending}
          disabled={description.trim().length < 3 || !from || !to || from.id === to.id || !scheduled}
        />
      </ActionBar>

      <Sheet
        visible={picker === "from" || picker === "to"}
        onClose={() => setPicker(null)}
        title={picker === "from" ? "Collect from" : "Deliver to"}
      >
        <View className="gap-1">
          {(checkpoints ?? []).map((c) => (
            <Option
              key={c.id}
              title={c.name}
              meta={c.description ?? undefined}
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

      <Sheet visible={picker === "day"} onClose={() => setPicker(null)} title="Which run?">
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
    </Screen>
  );
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
