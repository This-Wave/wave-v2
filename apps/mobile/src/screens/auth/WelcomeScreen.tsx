import { useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { Button, Field, Gutter, PhoneField, Row, RowGroup, Screen, ScreenBody, Sheet } from "../../components/v6";
import { useLayout } from "../../hooks/useLayout";
import { GHANA_LOCAL_PHONE_LENGTH, toGhanaE164 } from "@wave/shared";
import { recordGuestVisit } from "../../lib/growth";
import { Illustration, Rise } from "../../components/v7/Illustration";
import { WaveMarkIcon } from "../../components/icons";
import { useUniversities } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

// Dev-only shortcuts so screens past the login gate can be browsed without a
// real SMS OTP round trip. Each signs in as a real seeded Supabase user (see
// packages/db/prisma/seed.ts), so AuthProvider picks up a real session and
// every backend call behaves exactly as it would for that role.
const DEV_LOGINS = [
  { label: "student", phone: "+233241234567", password: "WaveDev123!" },
  { label: "rider", phone: "+233551234567", password: "WaveRider123!" },
  { label: "shop owner", phone: "+233201234567", password: "WaveShop123!" },
];

/**
 * The first screen.
 *
 * v5 ran a three-slide carousel with a placeholder image on each — three taps
 * before anyone could sign in, and the images were never sourced. It is one
 * screen now: what Wave is, when the next Wave leaves, and a way in.
 *
 * Naming the next Wave here is deliberate. The single hardest thing to explain
 * about Wave is that it is scheduled rather than on-demand, and a student who
 * learns that at checkout has already formed the wrong expectation.
 */
export function WelcomeScreen({ navigation }: Props) {
  const [devError, setDevError] = useState<string | null>(null);
  const [pickingCampus, setPickingCampus] = useState(false);
  const { data: universities } = useUniversities();
  const startGuest = useAuthStore((s) => s.startGuest);
  const { isDesktop } = useLayout();
  const [localNumber, setLocalNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Looking around asks two things: a first name (so the team knows who is
  // browsing, and Home can say hello), and a campus when more than one is live,
  // because shops and checkpoints are per campus.
  const [guestName, setGuestName] = useState("");
  const [guestCampus, setGuestCampus] = useState<string | null>(null);

  function lookAround() {
    if (!universities?.length) return;
    setGuestCampus(universities.length === 1 ? universities[0]!.id : null);
    setPickingCampus(true);
  }

  const trimmedName = guestName.trim();
  const canStartGuest = trimmedName.length > 0 && !!guestCampus;

  function startLooking() {
    if (!canStartGuest || !guestCampus) return;
    setPickingCampus(false);
    recordGuestVisit(trimmedName, guestCampus);
    startGuest(guestCampus, trimmedName);
  }

  const lookSheet = (
    <Sheet
        visible={pickingCampus}
        onClose={() => setPickingCampus(false)}
        title="What should we call you?"
        footer={<Button label="Look around" disabled={!canStartGuest} onPress={startLooking} />}
      >
        <View style={{ gap: 20 }}>
          <Field
            label="First name"
            value={guestName}
            onChangeText={setGuestName}
            placeholder="Ama"
            hint="No account needed to look around."
            maxLength={40}
            autoFocus
          />
          {(universities?.length ?? 0) > 1 ? (
            <View>
              <Text className="mb-2 font-sans-bold text-body text-ink">Your campus</Text>
              <RowGroup>
                {(universities ?? []).map((u) => (
                  <Row
                    key={u.id}
                    title={u.name}
                    meta={guestCampus === u.id ? "Selected" : `${u.city}, ${u.country}`}
                    onPress={() => setGuestCampus(u.id)}
                  />
                ))}
              </RowGroup>
            </View>
          ) : null}
        </View>
      </Sheet>
  );

  async function sendCode() {
    setSending(true);
    setPhoneError(null);
    const phone = toGhanaE164(localNumber);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setSending(false);
    if (error) {
      setPhoneError(error.message);
      return;
    }
    navigation.replace("OtpVerify", { phone });
  }

  if (isDesktop) {
    // v7 canvas "Web start": the promise on a wash half, sign-in on the
    // other, so a laptop visitor can start without a second page.
    return (
      // The auth stack sits in a narrow column on web; this one screen fills
      // the window like the canvas, so it lifts itself out of that column.
      <View
        className="flex-row bg-canvas"
        style={{ position: "fixed" as "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
      >
        <View className="flex-1 bg-wash" style={{ paddingHorizontal: 64, paddingTop: 48, paddingBottom: 48 }}>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <WaveMarkIcon size={36} />
            <Text className="font-sans-bold text-ink" style={{ fontSize: 26, letterSpacing: -0.8 }}>wave</Text>
          </View>
          <View className="flex-1 justify-center" style={{ gap: 18 }}>
            <Rise>
              <Text accessibilityRole="header" className="font-display text-ink" style={{ fontSize: 72, lineHeight: 76 }}>
                Stay in.{"\n"}We'll fetch it.
              </Text>
            </Rise>
            <Rise delay={80}>
              <Text className="font-sans text-subheading text-muted">Your things from Accra, on campus every day.</Text>
            </Rise>
          </View>
          <View className="items-end">
            <Illustration name="box" width={420} height={310} />
          </View>
        </View>
        <View className="justify-center" style={{ width: 560, paddingHorizontal: 80, gap: 20 }}>
          <Text className="font-display text-heading text-ink">Sign in or sign up</Text>
          <PhoneField label="Phone number" value={localNumber} onChangeText={setLocalNumber} error={phoneError} />
          <Button
            label="Continue"
            loading={sending}
            disabled={localNumber.length < GHANA_LOCAL_PHONE_LENGTH}
            onPress={() => void sendCode()}
          />
          <Text
            accessibilityRole="button"
            onPress={lookAround}
            className="text-center font-sans-bold text-ui text-link"
          >
            Look around first
          </Text>
        </View>
        {lookSheet}
      </View>
    );
  }

  return (
    <Screen>
      <View className="flex-1 bg-canvas">
        <ScreenBody bottomInset={16}>
          <Gutter className="pt-6">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <WaveMarkIcon size={32} />
              <Text className="font-sans-bold text-ink" style={{ fontSize: 24, letterSpacing: -0.8 }}>
                wave
              </Text>
            </View>
          </Gutter>
          <View className="flex-1 items-center justify-center px-gutter" style={{ gap: 18, minHeight: 460 }}>
            <Rise>
              <Illustration name="box" width={290} height={220} />
            </Rise>
            <Rise delay={80}>
              <Text accessibilityRole="header" className="text-center font-display text-display text-ink">
                Stay in.{"\n"}We'll fetch it.
              </Text>
            </Rise>
            <Rise delay={160}>
              <Text className="text-center font-sans text-ui text-muted" style={{ lineHeight: 24 }}>
                Your things from Accra, on campus every day.
              </Text>
            </Rise>
          </View>
        </ScreenBody>

        <View className="gap-3 px-gutter pb-9">
          <Button label="Get started" onPress={() => navigation.replace("PhoneEntry")} />
          <Button label="Look around" variant="ghost" onPress={lookAround} disabled={!universities?.length} />

          {__DEV__ ? (
            <View className="flex-row justify-center gap-4 pt-1">
              {DEV_LOGINS.map((login) => (
                <Text
                  key={login.label}
                  accessibilityRole="button"
                  className="font-sans text-meta text-muted"
                  onPress={() =>
                    supabase.auth
                      .signInWithPassword({ phone: login.phone, password: login.password })
                      .then(({ error }) => {
                        if (error) setDevError(error.message);
                      })
                  }
                >
                  dev: {login.label}
                </Text>
              ))}
            </View>
          ) : null}
          {devError ? (
            <Text className="text-center font-sans text-meta text-white">{devError}</Text>
          ) : null}
        </View>
      </View>

      {lookSheet}
    </Screen>
  );
}

