import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BusinessLeadKind } from "@wave/shared";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ActionBar, Button, Field, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useAuthStore, useViewerUniversityId } from "../../store/authStore";
import { useUniversities } from "../../lib/checkpoints";
import { submitBusinessLead } from "../../lib/growth";

const KINDS: Array<{ kind: BusinessLeadKind; title: string; body: string }> = [
  {
    kind: "bulk_pickup",
    title: "Bulk pickups from Accra",
    body: "You buy stock in Accra. We collect it from one place and bring it to campus for you.",
  },
  {
    kind: "shop_listing",
    title: "A shop on Wave",
    body: "List the things students can't get on campus. We bring each order up from Accra.",
  },
];

/**
 * "Own a business on campus?" A lead form, not a signup: Wave calls back.
 * The no-on-campus-delivery line is deliberate and stays visible: every Wave
 * delivery starts in Accra, and a business owner who expects hall-to-hall
 * runs needs to know before they apply.
 */
export function BusinessInterestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const profile = useAuthStore((s) => s.profile);
  const guestName = useAuthStore((s) => s.guestFirstName);
  const universityId = useViewerUniversityId();
  const { data: universities } = useUniversities();
  const campus = universities?.find((u) => u.id === universityId)?.name ?? "campus";

  const [kind, setKind] = useState<BusinessLeadKind | null>(null);
  const [fullName, setFullName] = useState(profile?.fullName ?? guestName ?? "");
  const [phone, setPhone] = useState(profile?.phone?.replace(/^\+233/, "0") ?? "");
  const [businessName, setBusinessName] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSend = !!kind && fullName.trim().length >= 2 && phone.trim().length >= 9 && businessName.trim().length >= 2;

  async function send() {
    if (!canSend || !kind) return;
    setSending(true);
    setError(null);
    try {
      await submitBusinessLead({
        kind,
        fullName: fullName.trim(),
        phone: phone.trim(),
        businessName: businessName.trim(),
        universityId,
        details: details.trim() || undefined,
      });
      setSent(true);
    } catch {
      setError("That didn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Screen narrow>
        <TopBar onBack={() => navigation.goBack()} />
        <ScreenBody bottomInset={16}>
          <Gutter className="pt-6">
            <Text accessibilityRole="header" className="font-display text-heading text-ink">
              Thanks, we'll call you
            </Text>
            <Text className="mt-2 font-sans text-body text-muted">
              Someone from Wave will call {phone.trim()} within two working days to set things up.
            </Text>
          </Gutter>
        </ScreenBody>
        <ActionBar>
          <Button label="Back to Home" onPress={() => navigation.goBack()} />
        </ActionBar>
      </Screen>
    );
  }

  return (
    <Screen narrow>
      <TopBar onBack={() => navigation.goBack()} />
      <ScreenBody bottomInset={16}>
        <Gutter className="pt-2">
          <Text accessibilityRole="header" className="font-display text-heading text-ink">
            Run a business on {campus}?
          </Text>
          <Text className="mt-2 font-sans text-body text-muted">
            We bring what you need from Accra to campus.
          </Text>

          <View className="mt-4 rounded-card bg-lime-faint px-4 py-3">
            <Text className="font-sans-medium text-body text-ink">
              We don't deliver within campus. Every Wave delivery starts in Accra.
            </Text>
          </View>

          <Text className="mb-2 mt-6 font-sans-medium text-body text-ink">What would help most?</Text>
          <View className="gap-2" accessibilityRole="radiogroup">
            {KINDS.map((k) => {
              const selected = kind === k.kind;
              return (
                <Pressable
                  key={k.kind}
                  onPress={() => setKind(k.kind)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  className={`flex-row items-start gap-3 rounded-card px-4 py-4 ${selected ? "bg-lime-faint" : "bg-surface"}`}
                >
                  <View className="flex-1">
                    <Text className="font-sans-medium text-ui text-ink">{k.title}</Text>
                    <Text className="mt-1 font-sans text-body text-muted">{k.body}</Text>
                  </View>
                  {selected ? <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View className="mt-6 gap-4">
            <Field label="Your name" value={fullName} onChangeText={setFullName} maxLength={80} />
            <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={15} placeholder="024 123 4567" />
            <Field label="Business name" value={businessName} onChangeText={setBusinessName} maxLength={80} />
            <Field
              label="Anything else? (optional)"
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={500}
              placeholder="What you sell, where in Accra you buy, how often"
            />
          </View>
          {error ? <Text className="mt-3 font-sans text-body text-muted">{error}</Text> : null}
        </Gutter>
      </ScreenBody>
      <ActionBar>
        <Button label={sending ? "Sending…" : "Send"} disabled={!canSend || sending} onPress={() => void send()} />
      </ActionBar>
    </Screen>
  );
}
