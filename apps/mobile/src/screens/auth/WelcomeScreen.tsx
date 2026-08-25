import { useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody } from "../../components/v6";
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
  const wave = useWave();

  return (
    <Screen>
      <ScreenBody bottomInset={16}>
        <Gutter className="pt-16">
          <View className="mb-10 flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-pill bg-lime">
              <Text className="font-sans-bold text-ui text-ink">W</Text>
            </View>
            <Text className="font-sans-bold text-ink" style={{ fontSize: 30, lineHeight: 34 }}>
              wave
            </Text>
          </View>

          <Text
            className="mb-4 font-sans-bold text-ink"
            style={{ fontSize: 36, lineHeight: 40, letterSpacing: -0.8 }}
          >
            Off-campus shops,{"\n"}delivered to your hall.
          </Text>
          <Text className="mb-10 font-sans text-ui text-muted">
            Tell us what you need. A runner buys it and brings it to your checkpoint on the next
            Wave.
          </Text>

          {wave ? (
            <View className="rounded-card bg-surface p-5">
              <Text className="mb-1 font-sans-semibold text-meta text-muted">NEXT WAVE</Text>
              <Text className="font-sans-medium text-subheading text-ink">{wave.dateLabel}</Text>
              <Text className="mt-1 font-sans text-body text-muted">
                Ordering closes in {wave.countdown}. Wave runs Sundays and Wednesdays.
              </Text>
            </View>
          ) : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-3">
          <Button label="Get started" onPress={() => navigation.replace("PhoneEntry")} />

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
            <Text className="text-center font-sans text-meta text-danger">{devError}</Text>
          ) : null}
        </View>
      </ActionBar>
    </Screen>
  );
}
