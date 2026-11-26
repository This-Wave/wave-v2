import { useMemo, useState } from "react";
import { usePickupPointStore } from "../../store/pickupPointStore";
import { GuestAccountSheet } from "../../components/GuestAccountSheet";
import type { ResumeTarget } from "../../store/authStore";
import { Platform, Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Field, Gutter, Screen, ScreenBody, Sheet, TopBar } from "../../components/v6";
import { CalendarIcon, CheckIcon, ChevronRightIcon, PinDotIcon, PinIcon, UserIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { pickupFeeFor, useCheckpoints, usePricing } from "../../lib/checkpoints";
import { useCreateOrder } from "../../lib/orders";
import { useIsGuest, useViewerUniversityId } from "../../store/authStore";
import { DEFAULT_DELIVERY_FEE_GHS, SIZE_INFO, type PackageSize } from "@wave/shared";
import { deliveryDayFor, formatFullDay, formatGhs, isStandardRunDay, toApiDate, upcomingRunDays } from "../../lib/pricing";
import { Rise } from "../../components/v7/Illustration";

type Route = RouteProp<StudentStackParamList, "PickupRequest">;
type Step = 0 | 1 | 2 | 3;
const HANDOVER = ["Meet outside", "At the door", "Leave with security"] as const;

/** Phonebook picker: the web Contact Picker API (Android Chrome). Absent on iPhone Safari. */
type ContactsNav = Navigator & { contacts?: { select: (props: string[], opts?: { multiple?: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> } };
function contactsSupported(): boolean {
  return Platform.OS === "web" && typeof navigator !== "undefined" && !!(navigator as ContactsNav).contacts?.select;
}
async function pickContact(): Promise<{ name: string; phone: string } | null> {
  try {
    const [c] = (await (navigator as ContactsNav).contacts!.select(["name", "tel"], { multiple: false })) ?? [];
    if (!c) return null;
    return { name: c.name?.[0] ?? "", phone: (c.tel?.[0] ?? "").replace(/[^\d+]/g, "") };
  } catch {
    return null;
  }
}

/**
 * v7 Send a package (owner, 2026-11-26: "the Uber way"). The student is always
 * the receiver, so the four steps collect the SENDER: who they are (from
 * contacts or typed), where to collect (Accra zone dropdown, building, floor,
 * landmark, how they hand it over, instructions), what it is (size sets the
 * price with the zone add-on) and a review. One job per step (Hick), a
 * progress bar (goal-gradient), the button always at the bottom (Fitts).
 */
export function PickupRequestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const viewerUniversityId = useViewerUniversityId();
  const { data: checkpoints } = useCheckpoints(viewerUniversityId);
  const { data: pricing } = usePricing();
  const isGuest = useIsGuest();
  const createOrder = useCreateOrder();

  const [step, setStep] = useState<Step>(0);
  const [accountPrompt, setAccountPrompt] = useState<ResumeTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<"zone" | "to" | "day" | null>(null);

  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [fromId, setFromId] = useState<string | null>(params?.fromId ?? null);
  const defaultTo = usePickupPointStore((st) => st.defaultId);
  const [toId, setToId] = useState<string | null>(params?.toId ?? defaultTo ?? null);
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [landmark, setLandmark] = useState("");
  const [handover, setHandover] = useState<(typeof HANDOVER)[number]>("Meet outside");
  const [instructions, setInstructions] = useState("");
  const [size, setSize] = useState<PackageSize | null>(null);
  const [description, setDescription] = useState(params?.description ?? "");
  const [dayIndex, setDayIndex] = useState(0);

  const chosenDate = params?.scheduledDate ? new Date(params.scheduledDate) : null;
  const days = useMemo(() => upcomingRunDays(new Date(), 4), []);
  const scheduled = chosenDate ?? days[dayIndex];
  const isSpecialOrder = params?.isSpecialOrder ?? (scheduled ? !isStandardRunDay(scheduled) : false);
  const zonePoints = (checkpoints ?? []).filter((c) => c.zone);
  const campusPoints = (checkpoints ?? []).filter((c) => !c.zone);
  const from = zonePoints.find((c) => c.id === fromId) ?? zonePoints[0];
  const to = campusPoints.find((c) => c.id === toId) ?? campusPoints[0];
  const sizes = pricing?.sizes ?? SIZE_INFO.map((x) => ({ key: x.key, label: x.label, examples: x.examples, maxKg: x.maxKg, price: x.defaultPrice }));
  const sizePrice = sizes.find((x) => x.key === size)?.price ?? null;
  const baseFee = pricing?.baseFee ?? DEFAULT_DELIVERY_FEE_GHS;
  const fee = pickupFeeFor(from, baseFee, sizePrice);
  const zoneAddOn = from?.zone ? Number(from.zone.deliveryFee) : 0;

  const senderOk = senderName.trim().length >= 2 && senderPhone.replace(/\D/g, "").length >= 9;
  const pickupOk = !!from && !!to;
  const itemOk = !!size && description.trim().length >= 3 && !!scheduled;
  const canNext = [senderOk, pickupOk, itemOk, senderOk && pickupOk && itemOk][step];

  const pickupNotes = [
    [building.trim(), floor.trim() ? `floor ${floor.trim()}` : ""].filter(Boolean).join(", "),
    landmark.trim() ? `Landmark: ${landmark.trim()}` : "",
    `Handover: ${handover}`,
    instructions.trim(),
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 300);

  async function pay() {
    if (!from || !to || !scheduled || !size) return;
    setError(null);
    if (isGuest) {
      setAccountPrompt({ route: "PickupRequest", params: { ...params, fromId: from.id, toId: to.id, description } });
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
        pickupNotes: pickupNotes || undefined,
        packageSize: size,
        deliveryDay: deliveryDayFor(scheduled, isSpecialOrder),
        scheduledDate: toApiDate(scheduled),
        isSpecialOrder,
      });
      navigation.replace("Payment", { orderId: order.id, totalAmount: Number(order.totalAmount) });
    } catch {
      setError("Couldn't create your delivery. Please try again.");
    }
  }

  const titles = ["Who's sending it?", "Where do we collect?", "What is it?", "Review"];
  const back = () => (step === 0 ? navigation.goBack() : setStep((s) => (s - 1) as Step));
  const next = () => (step === 3 ? void pay() : setStep((s) => (s + 1) as Step));

  return (
    <Screen narrow>
      <TopBar title="Send a package" onBack={back} />
      <View className="mx-gutter h-1.5 overflow-hidden rounded-pill bg-hairline" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 4, now: step + 1 }}>
        <View className="h-1.5 rounded-pill bg-lime" style={{ width: `${((step + 1) / 4) * 100}%` }} />
      </View>

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-4" style={{ gap: 16 }}>
          <Rise key={step}>
            <Text accessibilityRole="header" className="font-display text-heading text-ink">
              {titles[step]}
            </Text>
          </Rise>

          {step === 0 ? (
            <Rise key="s0" delay={60}>
              <View style={{ gap: 16 }}>
                {contactsSupported() ? (
                  <Button
                    label="Choose from contacts"
                    variant="ghost"
                    icon={<UserIcon size={20} color={colors.ink} strokeWidth={2} />}
                    onPress={() =>
                      void pickContact().then((c) => {
                        if (!c) return;
                        if (c.name) setSenderName(c.name);
                        if (c.phone) setSenderPhone(c.phone);
                      })
                    }
                  />
                ) : null}
                <Field label="Sender's name" value={senderName} onChangeText={setSenderName} placeholder="Full name" maxLength={80} />
                <Field
                  label="Sender's phone"
                  value={senderPhone}
                  onChangeText={setSenderPhone}
                  keyboardType="phone-pad"
                  placeholder="024 123 4567"
                  hint="The rider calls this number to collect."
                  maxLength={15}
                />
              </View>
            </Rise>
          ) : null}

          {step === 1 ? (
            <Rise key="s1" delay={60}>
              <View style={{ gap: 16 }}>
                <View>
                  <Text className="mb-2 font-sans-bold text-body text-ink">Pickup area in Accra</Text>
                  <Pressable
                    onPress={() => setPicker("zone")}
                    accessibilityRole="button"
                    accessibilityLabel={`Pickup area: ${from?.name ?? "choose"}`}
                    className="min-h-[56px] flex-row items-center justify-between rounded-input border-2 border-line bg-surface px-4"
                  >
                    <Text className="font-sans-bold text-ui text-ink">{from?.name ?? "Choose an area"}</Text>
                    <ChevronRightIcon size={18} color={colors.ink} strokeWidth={2.2} />
                  </Pressable>
                </View>
                <View className="flex-row" style={{ gap: 12 }}>
                  <View className="flex-1"><Field label="Building or shop" value={building} onChangeText={setBuilding} placeholder="Shell station" maxLength={60} /></View>
                  <View className="w-28"><Field label="Floor" value={floor} onChangeText={setFloor} placeholder="Ground" maxLength={20} /></View>
                </View>
                <Field label="Landmark" value={landmark} onChangeText={setLandmark} placeholder="Opposite Legon main gate" maxLength={80} />
                <View>
                  <Text className="mb-2 font-sans-bold text-body text-ink">How they hand it over</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }} accessibilityRole="radiogroup">
                    {HANDOVER.map((h) => (
                      <Pressable
                        key={h}
                        onPress={() => setHandover(h)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: handover === h }}
                        className={`min-h-[40px] justify-center rounded-input border-2 px-3.5 ${handover === h ? "border-ink bg-ink" : "border-line bg-surface"}`}
                      >
                        <Text className={`font-sans-bold text-meta ${handover === h ? "text-white" : "text-ink"}`}>{h}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Field label="Pickup instructions (optional)" value={instructions} onChangeText={setInstructions} multiline placeholder="Call when you reach the Shell station." maxLength={140} />
                <PickerRow
                  icon={<PinDotIcon size={18} color={colors.ink} strokeWidth={1.9} />}
                  label="You collect at"
                  value={to?.name}
                  placeholder="Choose a pickup point"
                  onPress={() => setPicker("to")}
                />
              </View>
            </Rise>
          ) : null}

          {step === 2 ? (
            <Rise key="s2" delay={60}>
              <View style={{ gap: 12 }}>
                <View style={{ gap: 8 }} accessibilityRole="radiogroup">
                  {sizes.map((x) => {
                    const on = size === x.key;
                    return (
                      <Pressable
                        key={x.key}
                        onPress={() => setSize(x.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        className={`flex-row items-center gap-3 rounded-card border-2 px-4 py-3.5 ${on ? "border-ink bg-wash" : "border-line bg-surface"}`}
                      >
                        <View className="flex-1">
                          <Text className="font-sans-bold text-ui text-ink">{x.label}</Text>
                          <Text className="font-sans text-meta text-muted">
                            {x.examples} · up to {x.maxKg} kg
                          </Text>
                        </View>
                        <Text className="font-sans-bold text-ui text-ink">{formatGhs(x.price + zoneAddOn)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Field label="What is it?" value={description} onChangeText={setDescription} placeholder="A blue backpack" maxLength={200} />
                <PickerRow
                  icon={<CalendarIcon size={18} color={colors.ink} strokeWidth={1.9} />}
                  label="Arrives on"
                  value={scheduled ? formatFullDay(scheduled) : undefined}
                  placeholder="Choose a day"
                  onPress={chosenDate ? undefined : () => setPicker("day")}
                />
              </View>
            </Rise>
          ) : null}

          {step === 3 ? (
            <Rise key="s3" delay={60}>
              <View style={{ gap: 12 }}>
                <View className="rounded-card border border-hairline bg-surface p-4">
                  <PickerRow icon={<PinIcon size={18} color={colors.ink} strokeWidth={1.9} />} label={`Pickup · ${from?.name ?? ""}`} value={`${senderName.trim()} · ${senderPhone.trim()}`} placeholder="" onPress={() => setStep(0)} />
                  <Text className="ml-11 font-sans text-meta text-muted" numberOfLines={2}>{pickupNotes}</Text>
                  <View className="my-1 ml-4 h-4 border-l border-dashed border-line" />
                  <PickerRow icon={<PinDotIcon size={18} color={colors.ink} strokeWidth={1.9} />} label="You, at" value={to?.name} placeholder="" onPress={() => setStep(1)} />
                </View>
                <View className="flex-row items-center justify-between rounded-card border border-hairline bg-surface p-4">
                  <View className="flex-1">
                    <Text className="font-sans-bold text-body text-ink">{sizes.find((x) => x.key === size)?.label} size</Text>
                    <Text className="font-sans text-meta text-muted" numberOfLines={1}>{description.trim()} · {scheduled ? formatFullDay(scheduled) : ""}</Text>
                  </View>
                  <Text accessibilityRole="link" onPress={() => setStep(2)} className="font-sans-bold text-body text-link">Edit</Text>
                </View>
                <View className="flex-row items-center  rounded-card bg-wash p-4" style={{ gap: 12 }}>
                  <CheckIcon size={22} color={colors.ink} strokeWidth={2.2} />
                  <View className="flex-1">
                    <Text className="font-sans-bold text-body text-ink">Only you can collect</Text>
                    <Text className="font-sans text-meta text-ink-700">Your 6-digit code comes after you pay.</Text>
                  </View>
                </View>
                <Text className="font-sans text-meta text-muted">We can't carry cash, alcohol, medication, weapons or anything illegal.</Text>
              </View>
            </Rise>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        {error ? <Text className="mb-3 font-sans text-body text-danger">{error}</Text> : null}
        {step >= 2 ? (
          <View className="mb-3 flex-row items-baseline justify-between">
            <Text className="font-sans text-ui text-muted">Total</Text>
            <Text className="font-display text-heading-sm text-ink">{formatGhs(fee)}</Text>
          </View>
        ) : null}
        <Button
          label={step === 3 ? (isGuest ? `Continue · ${formatGhs(fee)}` : `Pay ${formatGhs(fee)}`) : "Next"}
          onPress={next}
          loading={createOrder.isPending}
          disabled={!canNext}
        />
      </ActionBar>

      <Sheet visible={picker === "zone" || picker === "to"} onClose={() => setPicker(null)} title={picker === "zone" ? "Pickup area in Accra" : "Where you collect"}>
        <View style={{ gap: 4 }}>
          {(picker === "zone" ? zonePoints : campusPoints).map((c) => (
            <Option
              key={c.id}
              title={c.name}
              meta={picker === "zone" ? (Number(c.zone?.deliveryFee ?? 0) > 0 ? `+${formatGhs(Number(c.zone?.deliveryFee))}` : "No extra charge") : (c.description ?? undefined)}
              selected={(picker === "zone" ? from?.id : to?.id) === c.id}
              onPress={() => {
                if (picker === "zone") setFromId(c.id);
                else setToId(c.id);
                setPicker(null);
              }}
            />
          ))}
        </View>
      </Sheet>
      <Sheet visible={picker === "day"} onClose={() => setPicker(null)} title="Which day?">
        <View style={{ gap: 4 }}>
          {days.map((d, i) => (
            <Option key={i} title={formatFullDay(d)} selected={dayIndex === i} onPress={() => { setDayIndex(i); setPicker(null); }} />
          ))}
        </View>
      </Sheet>
      <GuestAccountSheet target={accountPrompt} onClose={() => setAccountPrompt(null)} />
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
        <Text className="font-sans-bold text-body text-ink">{title}</Text>
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
