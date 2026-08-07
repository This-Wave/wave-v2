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
import { earliestSpecialOrderDate, formatFullDay, upcomingRunDays } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "DescribeOrder">;

/**
 * "Buy For Me", rebuilt as one question per block on a plain canvas.
 *
 * Two things v5 got wrong that are fixed here:
 *  - "Deliver to" was a field that *cycled* to the next checkpoint on each tap,
 *    with no way to see the options or go back one. It is now a real picker.
 *  - The run day was a row of three chips including a "Rush +30%" cell whose
 *    surcharge was never explained. The surcharge is now stated in words at the
 *    point of choosing it.
 */
export function DescribeOrderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const profile = useAuthStore((s) => s.profile);
  const { data: checkpoints } = useCheckpoints(profile?.universityId ?? undefined);

  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [dayIndex, setDayIndex] = useState(0);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [picker, setPicker] = useState<"day" | "checkpoint" | null>(null);

  const runDays = useMemo(() => upcomingRunDays(), []);
  const dayOptions = useMemo(() => [...runDays, earliestSpecialOrderDate()], [runDays]);
  const isSpecial = dayIndex === dayOptions.length - 1;
  const selectedDate = dayOptions[dayIndex];

  const checkpoint = checkpoints?.find((c) => c.id === checkpointId) ?? checkpoints?.[0];

  function handleContinue() {
    if (!checkpoint) return;
    // The backend has no budget column, so the cap rides in the runner notes,
    // which is where it is actually actionable at the till.
    const budgetLine = budget.trim() ? `Budget cap: GH₵${budget.trim()}` : "";
    const runnerNotes = [budgetLine, notes.trim()].filter(Boolean).join("\n");

    navigation.navigate("OrderSummary", {
      shopId: params.shopId,
      shopName: params.shopName,
      itemDescription: description,
      scheduledDate: selectedDate.toISOString(),
      isSpecialOrder: isSpecial,
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.name,
      budget: budget.trim() || undefined,
      notes: runnerNotes || undefined,
    });
  }

  return (
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter>
          <Text className="mb-1 font-sans-bold text-heading text-ink">What do you need?</Text>
          <Text className="mb-8 font-sans text-body text-muted">
            From {params.shopName}. Be specific — your runner buys exactly what you write.
          </Text>

          <View className="mb-6">
            <Field
              label="Your list"
              value={description}
              onChangeText={setDescription}
              placeholder={"1x extension cable (2m)\n1x A4 notebook, ruled"}
              multiline
              maxLength={500}
              hint={`${description.length}/500`}
            />
          </View>

          <View className="mb-6">
            <Field
              label="Spend up to"
              value={budget}
              onChangeText={setBudget}
              placeholder="150"
              keyboardType="numeric"
              hint="Your runner won't go over this. Leave blank for no cap."
            />
          </View>

          <Text className="mb-2 font-sans-medium text-body text-ink">Delivery</Text>
          <RowGroup>
            <Row
              title={formatFullDay(selectedDate)}
              meta={isSpecial ? "Rush order · 30% more on the delivery fee" : "Standard run"}
              onPress={() => setPicker("day")}
            />
            <Row
              title={checkpoint?.name ?? "Choose a checkpoint"}
              meta={checkpoint?.description ?? undefined}
              onPress={() => setPicker("checkpoint")}
            />
          </RowGroup>

          <View className="mt-6">
            <Field
              label="Anything else?"
              value={notes}
              onChangeText={setNotes}
              placeholder="Call me if the notebook is out of stock."
              multiline
            />
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Review order"
          onPress={handleContinue}
          disabled={description.trim().length < 3 || !checkpoint}
        />
      </ActionBar>

      <Sheet visible={picker === "day"} onClose={() => setPicker(null)} title="When?">
        <View className="gap-1">
          {dayOptions.map((date, i) => {
            const special = i === dayOptions.length - 1;
            return (
              <Option
                key={i}
                title={formatFullDay(date)}
                meta={special ? "Rush order · 30% more on the delivery fee" : "Standard run"}
                selected={dayIndex === i}
                onPress={() => {
                  setDayIndex(i);
                  setPicker(null);
                }}
              />
            );
          })}
        </View>
      </Sheet>

      <Sheet visible={picker === "checkpoint"} onClose={() => setPicker(null)} title="Where?">
        <View className="gap-1">
          {(checkpoints ?? []).map((c) => (
            <Option
              key={c.id}
              title={c.name}
              meta={c.description ?? undefined}
              selected={checkpoint?.id === c.id}
              onPress={() => {
                setCheckpointId(c.id);
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
