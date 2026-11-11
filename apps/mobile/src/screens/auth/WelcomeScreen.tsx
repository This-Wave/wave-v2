import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { Button, Gutter, Row, RowGroup, Screen, ScreenBody, Sheet } from "../../components/v6";
import { WavePinIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";
import { useUniversities } from "../../lib/checkpoints";
import { useAuthStore } from "../../store/authStore";
import { useReducedMotion } from "../../hooks/useReducedMotion";
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

  // Looking around needs a campus, because shops and checkpoints are per
  // campus. With one campus live there is nothing to ask.
  function lookAround() {
    if (!universities?.length) return;
    if (universities.length === 1) {
      startGuest(universities[0]!.id);
      return;
    }
    setPickingCampus(true);
  }

  return (
    <Screen className="bg-ink">
      <View className="flex-1 bg-ink" style={{ overflow: "hidden" }}>
        <ScreenBody bottomInset={16}>
          <Gutter className="pt-8">
            <View className="mb-16 flex-row items-center gap-2.5">
              <WavePinIcon size={36} />
              <Text className="font-sans-bold text-white" style={{ fontSize: 26, lineHeight: 30, letterSpacing: -0.5 }}>
                wave
              </Text>
            </View>

            <Text
              accessibilityRole="header"
              className="mb-5 font-sans-bold text-white"
              style={{ fontSize: 46, lineHeight: 48, letterSpacing: -1.6 }}
            >
              Town shops,{"\n"}to your hall.
            </Text>
            <Text className="font-sans text-white" style={{ fontSize: 18, lineHeight: 24, opacity: 0.85 }}>
              Every day. Order by noon.
            </Text>
          </Gutter>
          <WaveLines />
        </ScreenBody>

        <View className="gap-3 px-gutter pb-9">
          {wave ? (
            <View className="self-start rounded-pill px-3 py-1.5" style={{ backgroundColor: "rgba(255,255,255,0.14)" }}>
              <Text className="font-sans-medium text-meta text-white">
                {wave.name} · closes in {wave.countdown}
              </Text>
            </View>
          ) : null}
          <Button label="Get started" onPress={() => navigation.replace("PhoneEntry")} />
          {/* Outline on the panel: the ink "inverse" button would vanish here. */}
          <Pressable
            onPress={lookAround}
            disabled={!universities?.length}
            accessibilityRole="button"
            accessibilityState={{ disabled: !universities?.length }}
            className="min-h-[52px] items-center justify-center rounded-pill px-6 py-3 active:opacity-80"
            style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)" }}
          >
            <Text className="font-sans-medium text-ui text-white">Look around first</Text>
          </Pressable>

          {__DEV__ ? (
            <View className="flex-row justify-center gap-4 pt-1">
              {DEV_LOGINS.map((login) => (
                <Text
                  key={login.label}
                  accessibilityRole="button"
                  className="font-sans text-meta text-white"
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

      <Sheet visible={pickingCampus} onClose={() => setPickingCampus(false)} title="Your campus">
        <RowGroup>
          {(universities ?? []).map((u) => (
            <Row
              key={u.id}
              title={u.name}
              meta={`${u.city}, ${u.country}`}
              onPress={() => {
                setPickingCampus(false);
                startGuest(u.id);
              }}
            />
          ))}
        </RowGroup>
      </Sheet>
    </Screen>
  );
}

/** Three drifting wave lines from the canvas (board 22); still when motion is reduced. */
function WaveLines() {
  const reduceMotion = useReducedMotion();
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, reduceMotion]);
  const tones = ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.18)", colors.lime];
  const path =
    "M0 24 Q 32.5 0 65 24 T 130 24 T 195 24 T 260 24 T 325 24 T 390 24 T 455 24 T 520 24 T 585 24 T 650 24 T 715 24 T 780 24";
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="mt-12" style={{ height: 170 }}>
      {tones.map((stroke, i) => (
        <Animated.View
          key={stroke}
          style={{
            position: "absolute",
            top: i * 52,
            left: 0,
            transform: [
              {
                translateX: drift.interpolate({
                  inputRange: [0, 1],
                  // Each line moves at its own pace; all loop on a 130px period.
                  outputRange: [0, -130 * (i + 1)],
                }),
              },
            ],
          }}
        >
          <Svg width={780 + 390} height={48} viewBox="0 0 1170 48">
            <Path d={path} stroke={stroke} strokeWidth={10} strokeLinecap="round" fill="none" />
            <Path d={path} stroke={stroke} strokeWidth={10} strokeLinecap="round" fill="none" transform="translate(780 0)" />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}
