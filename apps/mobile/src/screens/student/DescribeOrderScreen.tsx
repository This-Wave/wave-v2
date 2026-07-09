import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, X } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { TextField } from "../../components/ui/TextField";
import { DaySelectorCard } from "../../components/ui/DaySelectorCard";
import { Button } from "../../components/ui/Button";
import { useCheckpoints } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { earliestSpecialOrderDate, formatDayChip, upcomingRunDays } from "../../lib/pricing";

type Route = RouteProp<StudentStackParamList, "DescribeOrder">;

export function DescribeOrderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const { params } = useRoute<Route>();
  const profile = useAuthStore((s) => s.profile);
  const { data: checkpoints } = useCheckpoints(profile?.universityId ?? undefined);

  const [description, setDescription] = useState("");
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
    navigation.navigate("OrderSummary", {
      shopId: params.shopId,
      shopName: params.shopName,
      itemDescription: description,
      scheduledDate: selectedDate.toISOString(),
      isSpecialOrder: isSpecial,
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.name,
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-1.5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-5 flex-row items-center gap-3">
          <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} />
          <Text className="font-sans-extrabold text-[17px] tracking-tight text-ink">Buy For Me</Text>
        </View>

        <View className="mb-4 flex-row items-center gap-1.5 self-start rounded-pill border-[1.5px] border-success-border bg-success-bg px-3 py-1.5">
          <Text className="font-sans-semibold text-[12px] text-success-text">{params.shopName}</Text>
          <X size={12} color="#2EA64E" />
        </View>

        <TextField
          label="What should we buy?"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Rice and Stew (Chicken). Ask for extra stew please."
          multiline
          maxLength={500}
        />

        <Text className="mb-2.5 mt-5 font-sans-semibold text-xs text-text-secondary">Delivery Day</Text>
        <View className="flex-row gap-2.5">
          {dayOptions.map((date, index) => {
            const { dayLabel, dateLabel } = formatDayChip(date);
            const special = index === dayOptions.length - 1;
            return (
              <DaySelectorCard
                key={index}
                dayLabel={special ? "TODAY" : dayLabel}
                dateLabel={dateLabel}
                tag={special ? "+30%" : "Standard"}
                selected={selectedIndex === index}
                surcharge={special}
                onPress={() => setSelectedIndex(index)}
              />
            );
          })}
        </View>

        {checkpoints && checkpoints.length > 0 ? (
          <TextField
            label="Checkpoint"
            value={checkpoint?.name ?? ""}
            selectable
            onPress={() => setCheckpointIndex((i) => i + 1)}
          />
        ) : null}

        <View className="mt-7">
          <Button label="Continue" onPress={handleContinue} disabled={description.trim().length < 3 || !checkpoint} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
