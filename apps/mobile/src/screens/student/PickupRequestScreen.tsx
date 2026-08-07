import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import {
  ActionBar,
  Button,
  Field,
  Gutter,
  Row,
  RowGroup,
  Screen,
  ScreenBody,
  Sheet,
  TopBar,
} from "../../components/v6";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useCheckpoints } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { DEFAULT_DELIVERY_FEE_GHS } from "@wave/shared";
import { formatFullDay, formatGhs, upcomingRunDays } from "../../lib/pricing";

/**
 * Campus-to-campus package pickup: move something already on campus from one
 * checkpoint to another.
 *
 * ⚠️ This flow has no backend. `POST /orders` requires a `shopId`, and a pickup
 * has no shop — so the confirm button cannot create anything and simply returns.
 * v5 hid that behind a convincing four-step form with time slots. The screen now
 * says so out loud rather than taking details it will throw away.
 *
 * Both checkpoint fields are real pickers here; v5 cycled to the next checkpoint
 * on each tap, with no way to see the options or go back.
 */
export function PickupRequestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: checkpoints } = useCheckpoints(profile?.universityId ?? undefined);

  const [description, setDescription] = useState("");
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [picker, setPicker] = useState<"from" | "to" | "day" | null>(null);

  const days = useMemo(() => upcomingRunDays(new Date(), 4), []);
  const from = checkpoints?.find((c) => c.id === fromId) ?? checkpoints?.[0];
  const to = checkpoints?.find((c) => c.id === toId) ?? checkpoints?.[1] ?? checkpoints?.[0];

  return (
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text className="mb-2 font-sans-bold text-heading text-ink">Move a package</Text>
          <Text className="mb-8 font-sans text-body text-muted">
            Get something carried from one checkpoint to another on the next run.
          </Text>

          <View className="mb-6 rounded-card bg-surface p-5">
            <Text className="mb-1 font-sans-semibold text-meta text-muted">NOT LIVE YET</Text>
            <Text className="font-sans text-body text-ink">
              Package pickup isn't running for the pilot — every Wave order currently goes through a
              shop. You can see how it will work, but nothing is submitted.
            </Text>
          </View>

          <View className="mb-6">
            <Field
              label="What are we moving?"
              value={description}
              onChangeText={setDescription}
              placeholder="Blue bag left with the security guard at the main gate."
              multiline
            />
          </View>

          <Text className="mb-2 font-sans-medium text-body text-ink">Route</Text>
          <RowGroup>
            <Row
              title={from?.name ?? "Choose a pickup point"}
              meta="Collect from"
              onPress={() => setPicker("from")}
            />
            <Row
              title={to?.name ?? "Choose a drop-off"}
              meta="Deliver to"
              onPress={() => setPicker("to")}
            />
            <Row
              title={days[dayIndex] ? formatFullDay(days[dayIndex]) : "Choose a day"}
              meta={`Delivery fee ${formatGhs(DEFAULT_DELIVERY_FEE_GHS)}`}
              onPress={() => setPicker("day")}
            />
          </RowGroup>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button label="Package pickup isn't available yet" disabled />
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
