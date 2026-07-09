import { useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { useCheckpoints } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { DEFAULT_DELIVERY_FEE_GHS } from "@wave/shared";
import { formatGhs } from "../../lib/pricing";

export function PickupRequestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const { data: checkpoints } = useCheckpoints(profile?.universityId ?? undefined);

  const [description, setDescription] = useState("");
  const [fromIndex, setFromIndex] = useState(0);
  const [toIndex, setToIndex] = useState(1);

  const fromCheckpoint = checkpoints?.[fromIndex % (checkpoints.length || 1)];
  const toCheckpoint = checkpoints?.[toIndex % (checkpoints.length || 1)];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-1.5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-5 flex-row items-center gap-3">
          <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} />
          <Text className="font-sans-extrabold text-[17px] tracking-tight text-ink">Pickup Request</Text>
        </View>

        <View className="gap-4">
          <TextField
            label="What are we picking up?"
            value={description}
            onChangeText={setDescription}
            placeholder="Blue bag left with the security guard at Main Gate. Has my name on it."
            multiline
          />
          <TextField label="Pick up from" value={fromCheckpoint?.name ?? ""} selectable onPress={() => setFromIndex((i) => i + 1)} />
          <TextField label="Deliver to" value={toCheckpoint?.name ?? ""} selectable onPress={() => setToIndex((i) => i + 1)} />
        </View>

        <View className="mt-5 flex-row justify-between rounded-well border border-border p-3.5">
          <Text className="text-[13px] text-text-secondary">Estimated fee</Text>
          <Text className="font-sans-bold text-[13px] text-ink">{formatGhs(DEFAULT_DELIVERY_FEE_GHS)}</Text>
        </View>

        <View className="mt-6">
          <Button label="Submit Pickup Request" onPress={() => navigation.goBack()} disabled={description.trim().length < 3} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
