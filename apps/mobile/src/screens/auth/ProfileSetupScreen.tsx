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
  Screen,
  ScreenBody,
  Sheet,
} from "../../components/v6";
import { CheckIcon, ChevronDownIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useDropoffPoints, useUniversities } from "../../lib/checkpoints";
import { usePickupPointStore } from "../../store/pickupPointStore";
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
  // Name, campus, terms: nothing else stands between a student and their first
  // order (canvas board 26). Student ID and email are optional and live on
  // Profile, where they can be added later.
  student: {
    title: "Almost there",
    blurb: "",
    cta: "Start",
    askStudentId: false,
    emailHint: "",
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
  // A guest already chose a campus to browse; start from it.
  const [universityId, setUniversityId] = useState<string | null>(
    () => useAuthStore.getState().guestUniversityId,
  );
  const [picking, setPicking] = useState(false);
  // Starts unticked on purpose. A pre-ticked consent box is a dark pattern and
  // is not consent anyone could evidence later.
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setProfile = useAuthStore((s) => s.setProfile);

  const university = universities?.find((u) => u.id === universityId) ?? universities?.[0];
  const { data: points } = useDropoffPoints(university?.id);
  const defaultPoint = usePickupPointStore((st) => st.defaultId);
  const setDefaultPoint = usePickupPointStore((st) => st.setDefault);
  const [pickingPoint, setPickingPoint] = useState(false);
  const point =
    points?.find((cp) => cp.id === defaultPoint) ?? points?.find((cp) => /^on campus/i.test(cp.name)) ?? points?.[0];

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
        <Gutter className="pt-8">
          {/* v7 canvas: the last stretch of sign-up, shown as a nearly full bar. */}
          <View className="mb-6 h-1.5 overflow-hidden rounded-pill bg-hairline">
            <View className="h-full rounded-pill bg-lime" style={{ width: "90%" }} />
          </View>
          <Text accessibilityRole="header" className="mb-2 font-display text-heading text-ink">{copy.title}</Text>
          {copy.blurb ? (
            <Text className="mb-8 font-sans text-body text-muted">{copy.blurb}</Text>
          ) : (
            <View className="mb-4" />
          )}

          {role === "rider" ? (
            <View className="mb-8">
              <Text className="mb-2 font-sans-bold text-body text-ink">Are you a student here?</Text>
              <View className="gap-2">
                {RIDER_TYPE_OPTIONS.map((option) => {
                  const isSelected = riderType === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setRiderType(option.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      className={`flex-row items-start gap-3 rounded-card border-2 px-4 py-3.5 ${
                        isSelected ? "border-ink bg-wash" : "border-line bg-surface"
                      }`}
                    >
                      <View className="flex-1">
                        <Text className="font-sans-bold text-body text-ink">{option.title}</Text>
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
              label={role === "student" ? "Your name" : "Full name"}
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
            <Text className="mb-2 font-sans-bold text-body text-ink">Campus</Text>
            <SelectBox label={university?.name ?? "Choose your campus"} onPress={() => setPicking(true)} />
          </View>

          {role === "student" && points && points.length > 0 ? (
            <View className="mb-6">
              <Text className="mb-2 font-sans-bold text-body text-ink">Where you usually collect</Text>
              <SelectBox label={point?.name ?? "Choose a pickup point"} onPress={() => setPickingPoint(true)} />
            </View>
          ) : null}

          <View className="mb-6">
            <Field
              label={role === "student" ? "Email (optional)" : "Email"}
              value={email}
              onChangeText={setEmail}
              placeholder={role === "student" ? "For receipts" : "you@ashesi.edu.gh"}
              hint={copy.emailHint || undefined}
              keyboardType="email-address"
            />
          </View>

          {error ? <Text className="mt-4 font-sans text-body text-danger">{error}</Text> : null}
          <LegalNotice accepted={acceptedLegal} onChange={setAcceptedLegal} />
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label={copy.cta}
          onPress={handleContinue}
          loading={loading}
          disabled={
            !acceptedLegal || fullName.trim().length < 2 || (role === "rider" && !riderType)
          }
        />
      </ActionBar>

      <Sheet visible={pickingPoint} onClose={() => setPickingPoint(false)} title="Where you usually collect">
        <View style={{ gap: 8 }}>
          {(points ?? []).map((cp) => (
            <Pressable
              key={cp.id}
              onPress={() => {
                setDefaultPoint(cp.id);
                setPickingPoint(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: point?.id === cp.id }}
              className={`flex-row items-center gap-3 rounded-card border-2 px-4 py-3.5 ${
                point?.id === cp.id ? "border-ink bg-wash" : "border-line bg-surface"
              }`}
            >
              <View className="flex-1">
                <Text className="font-sans-bold text-body text-ink">{cp.name}</Text>
                {cp.description ? <Text className="font-sans text-meta text-muted">{cp.description}</Text> : null}
              </View>
              {point?.id === cp.id ? <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} /> : null}
            </Pressable>
          ))}
        </View>
      </Sheet>

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
              className={`flex-row items-center gap-3 rounded-card border-2 px-4 py-3.5 ${
                university?.id === u.id ? "border-ink bg-wash" : "border-line bg-surface"
              }`}
            >
              <View className="flex-1">
                <Text className="font-sans-bold text-body text-ink">{u.name}</Text>
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

/** v7 canvas select box: a 56px field with the value and a down chevron. */
function SelectBox({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[56px] flex-row items-center justify-between rounded-input border-2 border-line bg-surface px-4"
    >
      <Text className="font-sans-bold text-ui text-ink">{label}</Text>
      <ChevronDownIcon size={20} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}
