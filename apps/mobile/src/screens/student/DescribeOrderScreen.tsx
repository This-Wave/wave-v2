import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { TextField } from "../../components/ui/TextField";
import { FieldLabel } from "../../components/ui/FieldLabel";
import { DaySelectorCard } from "../../components/ui/DaySelectorCard";
import { Button } from "../../components/ui/Button";
import { useCheckpoints } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { earliestSpecialOrderDate, formatDayCell, upcomingRunDays } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "DescribeOrder">;

/**
 * v5 screen 05 "Buy For Me · Request". Field order follows the design exactly:
 * shop, items, the budget-cap / deliver-to pair, then runner notes. The run-day
 * chips are Wave-specific (the design assumes a single upcoming run) and use the
 * screen-07 day-chip treatment so they read as native to the set.
 */
export function DescribeOrderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const profile = useAuthStore((s) => s.profile);
  const { data: checkpoints } = useCheckpoints(profile?.universityId ?? undefined);

  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const runDays = useMemo(() => upcomingRunDays(), []);
  const specialDate = useMemo(() => earliestSpecialOrderDate(), []);
  const dayOptions = [...runDays, specialDate];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [checkpointIndex, setCheckpointIndex] = useState(0);

  const selectedDate = dayOptions[selectedIndex];
  const isSpecial = selectedIndex === dayOptions.length - 1;
  const checkpoint = checkpoints?.[checkpointIndex % (checkpoints.length || 1)];

  function handleContinue() {
    if (!checkpoint) return;
    // The backend has no budget field, so the cap rides along in the runner
    // notes where it's actually actionable at the till.
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
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Buy For Me" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-5">
          <FieldLabel>Where should we buy from?</FieldLabel>
          <View className="h-[52px] justify-center rounded-control border border-border bg-surface px-4">
            <Text className="font-sans-medium text-[15px] text-ink">{params.shopName}</Text>
          </View>
        </View>

        <View className="mb-5">
          <TextField
            label="What do you need?"
            value={description}
            onChangeText={setDescription}
            placeholder={"1x extension cable (2m)\n1x A4 notebook, ruled"}
            multiline
            maxLength={500}
          />
        </View>

        <View className="mb-5 flex-row gap-3">
          <View className="flex-1">
            <TextField
              label="Budget cap"
              value={budget}
              onChangeText={setBudget}
              placeholder="GH₵ 150"
              keyboardType="number-pad"
              accent
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Deliver to"
              value={checkpoint?.name ?? "Loading..."}
              selectable
              onPress={() => setCheckpointIndex((i) => i + 1)}
            />
          </View>
        </View>

        <FieldLabel>Delivery day</FieldLabel>
        <View className="mb-5 flex-row gap-2">
          {dayOptions.map((date, index) => {
            const { weekday, day } = formatDayCell(date);
            const special = index === dayOptions.length - 1;
            return (
              <DaySelectorCard
                key={index}
                dayLabel={special ? "Rush" : weekday}
                dateLabel={day}
                tag={special ? "+30%" : undefined}
                selected={selectedIndex === index}
                surcharge={special}
                onPress={() => setSelectedIndex(index)}
              />
            );
          })}
        </View>

        <TextField
          label="Notes for your runner"
          value={notes}
          onChangeText={setNotes}
          placeholder="Call me if the notebook is out of stock."
          multiline
          compactMultiline
        />
      </ScrollView>

      <View className="border-t border-border bg-canvas px-5 pb-11 pt-4">
        <Button label="Review order" onPress={handleContinue} disabled={description.trim().length < 3 || !checkpoint} />
      </View>
    </SafeAreaView>
  );
}
