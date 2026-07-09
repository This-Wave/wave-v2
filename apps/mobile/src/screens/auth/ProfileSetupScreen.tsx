import { useEffect, useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { useUniversities } from "../../lib/checkpoints";
import { completeProfile } from "../../lib/profile";
import { useAuthStore } from "../../store/authStore";

type Props = NativeStackScreenProps<AuthStackParamList, "ProfileSetup">;

export function ProfileSetupScreen({}: Props) {
  const { data: universities } = useUniversities();
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [universityIndex, setUniversityIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setProfile = useAuthStore((s) => s.setProfile);

  const selectedUniversity = universities?.[universityIndex % (universities.length || 1)];

  useEffect(() => {
    setUniversityIndex(0);
  }, [universities]);

  async function handleContinue() {
    if (!selectedUniversity) {
      setError("No universities available yet — check back once one is configured.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const profile = await completeProfile({
        fullName,
        role: "student",
        universityId: selectedUniversity.id,
        studentId: studentId || undefined,
      });
      setProfile(profile);
    } catch {
      setError("Couldn't save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-4">
        <View className="mb-7 flex-row gap-1.5">
          <View className="h-[3px] flex-1 rounded-full bg-wave-500" />
          <View className="h-[3px] flex-1 rounded-full bg-border" />
        </View>
        <Text className="mb-1 font-sans-extrabold text-[22px] tracking-tight text-ink">Set up your profile</Text>
        <Text className="mb-7 text-[13px] text-muted">Step 1 of 2 · Your identity</Text>

        <View className="gap-4">
          <TextField label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Kwame Mensah" />
          <TextField label="Student ID" value={studentId} onChangeText={setStudentId} placeholder="AUC/CS/21/0042" mono />
          <TextField
            label="University"
            value={selectedUniversity?.name ?? "Loading..."}
            selectable
            onPress={() => setUniversityIndex((i) => i + 1)}
          />
        </View>

        {error ? <Text className="mt-3 text-[12px] text-danger-text">{error}</Text> : null}

        <View className="mt-auto pb-6">
          <Button label="Continue" onPress={handleContinue} loading={loading} disabled={fullName.trim().length < 2} />
        </View>
      </View>
    </SafeAreaView>
  );
}
