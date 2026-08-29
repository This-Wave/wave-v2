import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
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
} from "../../components/v6";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useUniversities } from "../../lib/checkpoints";
import { completeProfile } from "../../lib/profile";
import { useAuthStore } from "../../store/authStore";
import { LegalNotice } from "../../components/LegalNotice";

type Props = NativeStackScreenProps<AuthStackParamList, "ProfileSetup">;

/**
 * The last step before the app.
 *
 * University was a field that *cycled* to the next one on each tap in v5 —
 * the same pattern the checkpoint pickers had — with no way to see the list.
 * It is a real picker now.
 */
export function ProfileSetupScreen(_props: Props) {
  const { data: universities } = useUniversities();
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setProfile = useAuthStore((s) => s.setProfile);

  const university = universities?.find((u) => u.id === universityId) ?? universities?.[0];

  async function handleContinue() {
    if (!university) {
      setError("No universities available yet — check back once one is configured.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const profile = await completeProfile({
        fullName,
        role: "student",
        universityId: university.id,
        studentId: studentId || undefined,
        email: email.trim() || undefined,
      });
      setProfile(profile);
    } catch {
      setError("Couldn't save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScreenBody bottomInset={16}>
        <Gutter className="pt-12">
          <Text className="mb-2 font-sans-bold text-heading text-ink">Who are you?</Text>
          <Text className="mb-10 font-sans text-body text-muted">
            Your runner needs a name to look for at the checkpoint.
          </Text>

          <View className="mb-6">
            <Field
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Kwame Mensah"
            />
          </View>

          <View className="mb-6">
            <Field
              label="Student ID"
              value={studentId}
              onChangeText={setStudentId}
              placeholder="AUC/CS/21/0042"
              hint="Optional — helps your runner find you."
            />
          </View>

          <View className="mb-6">
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@ashesi.edu.gh"
              hint="Optional — we'll email you when a shop you suggested goes live."
              keyboardType="email-address"
            />
          </View>

          <Text className="mb-2 font-sans-medium text-body text-ink">Campus</Text>
          <RowGroup>
            <Row
              title={university?.name ?? "Choose your campus"}
              meta={university ? `${university.city}, ${university.country}` : undefined}
              onPress={() => setPicking(true)}
            />
          </RowGroup>

          {error ? <Text className="mt-4 font-sans text-body text-danger">{error}</Text> : null}
          <LegalNotice />
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Start using Wave"
          onPress={handleContinue}
          loading={loading}
          disabled={fullName.trim().length < 2}
        />
      </ActionBar>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Your campus">
        <View className="gap-1">
          {(universities ?? []).map((u) => (
            <Pressable
              key={u.id}
              onPress={() => {
                setUniversityId(u.id);
                setPicking(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: university?.id === u.id }}
              className={`flex-row items-center gap-3 rounded-card px-4 py-3.5 ${
                university?.id === u.id ? "bg-lime-faint" : "bg-canvas"
              }`}
            >
              <View className="flex-1">
                <Text className="font-sans-medium text-body text-ink">{u.name}</Text>
                <Text className="font-sans text-body text-muted">
                  {u.city}, {u.country}
                </Text>
              </View>
              {university?.id === u.id ? (
                <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
