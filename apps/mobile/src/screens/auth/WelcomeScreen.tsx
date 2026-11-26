import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { Button, Field, Gutter, Row, RowGroup, Screen, ScreenBody, Sheet } from "../../components/v6";
import { recordGuestVisit } from "../../lib/growth";
import { Illustration, Rise } from "../../components/v7/Illustration";
import { colors } from "../../theme/tokens";
import { useUniversities } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";
import { useWave } from "../../lib/wave";

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
  const wave = useWave();
  const { data: universities } = useUniversities();
  const startGuest = useAuthStore((s) => s.startGuest);

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

  return (
    <Screen>
      <View className="flex-1 bg-canvas">
        <ScreenBody bottomInset={16}>
          <Gutter className="pt-6">
            <View className="flex-row items-center gap-2.5">
              <View className="h-9 w-9 items-center justify-center rounded-input bg-ink">
                <WaveMark size={22} color={colors.lime} />
              </View>
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
          {wave ? (
            <Text className="text-center font-sans-medium text-meta text-muted">
              {wave.name} · order by noon · closes in {wave.countdown}
            </Text>
          ) : null}
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

      <Sheet
        visible={pickingCampus}
        onClose={() => setPickingCampus(false)}
        title="Before you look around"
        footer={<Button label="Start looking" disabled={!canStartGuest} onPress={startLooking} />}
      >
        <View className="gap-5">
          <Field
            label="Your first name"
            value={guestName}
            onChangeText={setGuestName}
            placeholder="e.g. Ama"
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
    </Screen>
  );
}

function WaveMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0M3 15c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}
