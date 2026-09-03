import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RiderType, SelfServeProfileRole } from "@wave/shared";
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
 *
 * The role arrives from `RoleSelectScreen` rather than being hardcoded to
 * "student", which is what it was until onboarding existed. What the server
 * does with it differs sharply by role: `auth/routes.ts` sets
 * `isVerified: role === "student"`, so a rider or shop owner created here is
 * deliberately inert until an admin approves them. Each role's navigator is
 * responsible for saying so; this screen only states it up front so the wait
 * is not a surprise.
 */
const COPY: Record<
  SelfServeProfileRole,
  { title: string; blurb: string; cta: string; askStudentId: boolean; emailHint: string }
> = {
  student: {
    title: "Who are you?",
    blurb: "Your runner needs a name to look for at the checkpoint.",
    cta: "Start using Wave",
    askStudentId: true,
    emailHint: "Optional — we'll email you when a shop you suggested goes live.",
  },
  rider: {
    title: "Who are you?",
    blurb: "Students see this name when you take their order. Next you'll verify your ID.",
    cta: "Continue to verification",
    askStudentId: true,
    emailHint: "Optional — how we reach you about your account.",
  },
  shop_owner: {
    title: "Who runs the shop?",
    blurb: "Your name, not the shop's — you'll add the shop next.",
    cta: "Continue to shop details",
    askStudentId: false,
    emailHint: "Optional — how we reach you about your shop.",
  },
};

const RIDER_TYPE_OPTIONS: Array<{ value: RiderType; title: string; blurb: string }> = [
  {
    value: "student",
    title: "I'm a student here",
    blurb: "You'll verify with your student ID.",
  },
  {
    value: "external",
    title: "I'm not a student",
    blurb: "You'll need a Ghana Card or passport, plus a few extra details.",
  },
];

export function ProfileSetupScreen({ route }: Props) {
  const role = route.params.role;
  const copy = COPY[role];
  // Riders only. Asked rather than inferred from the student-ID field, which is
  // optional — a student who skipped it would otherwise be treated as an
  // outside hire, and that decides their documents, their pay and where they
  // are allowed to deliver.
  const [riderType, setRiderType] = useState<RiderType | null>(null);
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
        role,
        universityId: university.id,
        studentId: copy.askStudentId && studentId ? studentId : undefined,
        email: email.trim() || undefined,
        riderType: role === "rider" ? (riderType ?? undefined) : undefined,
      });
      // Setting the profile is what hands control to RootNavigator, which routes
      // on `profile.role`. A rider lands in the verification gate and a shop
      // owner in the shop gate, so there is nothing to navigate to from here.
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
          <Text className="mb-2 font-sans-bold text-heading text-ink">{copy.title}</Text>
          <Text className="mb-10 font-sans text-body text-muted">{copy.blurb}</Text>

          {role === "rider" ? (
            <View className="mb-8">
              <Text className="mb-2 font-sans-medium text-body text-ink">Are you a student here?</Text>
              <View className="gap-2">
                {RIDER_TYPE_OPTIONS.map((option) => {
                  const isSelected = riderType === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setRiderType(option.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      className={`flex-row items-start gap-3 rounded-card px-4 py-3.5 ${
                        isSelected ? "bg-lime-faint" : "bg-surface"
                      }`}
                    >
                      <View className="flex-1">
                        <Text className="font-sans-medium text-body text-ink">{option.title}</Text>
                        <Text className="mt-0.5 font-sans text-body text-muted">{option.blurb}</Text>
                      </View>
                      {isSelected ? (
                        <View className="pt-0.5">
                          <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View className="mb-6">
            <Field
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Kwame Mensah"
            />
          </View>

          {copy.askStudentId && (role !== "rider" || riderType === "student") ? (
            <View className="mb-6">
              <Field
                label="Student ID"
                value={studentId}
                onChangeText={setStudentId}
                placeholder="AUC/CS/21/0042"
                hint={
                  role === "rider"
                    ? "Optional — speeds up verification if you're a student rider."
                    : "Optional — helps your runner find you."
                }
              />
            </View>
          ) : null}

          <View className="mb-6">
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@ashesi.edu.gh"
              hint={copy.emailHint}
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
          label={copy.cta}
          onPress={handleContinue}
          loading={loading}
          disabled={fullName.trim().length < 2 || (role === "rider" && !riderType)}
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
