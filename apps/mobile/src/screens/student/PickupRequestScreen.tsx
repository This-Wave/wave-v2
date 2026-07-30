import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { TextField } from "../../components/ui/TextField";
import { DaySelectorCard } from "../../components/ui/DaySelectorCard";
import { SelectRow } from "../../components/ui/SelectRow";
import { Button } from "../../components/ui/Button";
import { BoxIcon } from "../../components/icons";
import { useCheckpoints } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { DEFAULT_DELIVERY_FEE_GHS } from "@wave/shared";
import { formatDayCell, formatGhs, upcomingRunDays } from "../../lib/pricing";

const TIME_SLOTS = [
  { range: "8:00 – 10:00", label: "Early morning" },
  { range: "12:00 – 14:00", label: "Midday" },
  { range: "16:00 – 18:00", label: "Afternoon" },
];

/**
 * v5 screen 07 "Schedule pickup": the item summary row, a four-up day rail, and
 * the fill-on-select time-slot list, with the confirm action naming the choice.
 */
export function PickupRequestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: checkpoints } = useCheckpoints(profile?.universityId ?? undefined);

  const [description, setDescription] = useState("");
  const [fromIndex, setFromIndex] = useState(0);
  const [toIndex, setToIndex] = useState(1);
  const [dayIndex, setDayIndex] = useState(0);
  const [slotIndex, setSlotIndex] = useState(1);

  const days = useMemo(() => upcomingRunDays(new Date(), 4), []);
  const fromCheckpoint = checkpoints?.[fromIndex % (checkpoints.length || 1)];
  const toCheckpoint = checkpoints?.[toIndex % (checkpoints.length || 1)];
  const selectedDay = days[dayIndex] ? formatDayCell(days[dayIndex]) : null;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Schedule pickup" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-6 flex-row items-center gap-3 rounded-card border border-border bg-surface p-3.5">
          <BoxIcon size={20} />
          <View className="flex-1">
            <Text className="font-sans-semibold text-[14px] text-ink">
              {description.trim() || "Your package"}
            </Text>
            <Text className="text-[12px] text-muted">
              {fromCheckpoint?.name ?? "Pickup point"} → {toCheckpoint?.name ?? "Drop-off"}
            </Text>
          </View>
          <Text className="font-sans-semibold text-[12px] text-wave-500">{formatGhs(DEFAULT_DELIVERY_FEE_GHS)}</Text>
        </View>

        <View className="mb-6 gap-5">
          <TextField
            label="What are we picking up?"
            value={description}
            onChangeText={setDescription}
            placeholder="Blue bag left with the security guard at Main Gate."
            multiline
            compactMultiline
          />
          <TextField
            label="Pick up from"
            value={fromCheckpoint?.name ?? "Loading..."}
            selectable
            onPress={() => setFromIndex((i) => i + 1)}
          />
          <TextField
            label="Deliver to"
            value={toCheckpoint?.name ?? "Loading..."}
            selectable
            onPress={() => setToIndex((i) => i + 1)}
          />
        </View>

        <Text className="mb-3 font-sans-semibold text-[18px] text-ink">Choose a day</Text>
        <View className="mb-7 flex-row gap-2">
          {days.map((date, index) => {
            const { weekday, day } = formatDayCell(date);
            return (
              <DaySelectorCard
                key={index}
                dayLabel={weekday}
                dateLabel={day}
                selected={dayIndex === index}
                onPress={() => setDayIndex(index)}
              />
            );
          })}
        </View>

        <Text className="mb-3 font-sans-semibold text-[18px] text-ink">Time slots</Text>
        <View className="gap-2.5">
          {TIME_SLOTS.map((slot, index) => (
            <SelectRow
              key={slot.range}
              fill
              title={slot.range}
              subtitle={slot.label}
              selected={slotIndex === index}
              onPress={() => setSlotIndex(index)}
            />
          ))}
        </View>
      </ScrollView>

      <View className="border-t border-border bg-canvas px-5 pb-11 pt-4">
        <Button
          label={selectedDay ? `Confirm pickup · ${selectedDay.weekday} ${selectedDay.day}` : "Confirm pickup"}
          onPress={() => navigation.goBack()}
          disabled={description.trim().length < 3}
        />
      </View>
    </SafeAreaView>
  );
}
