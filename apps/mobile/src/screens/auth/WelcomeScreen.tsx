import { useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { Button } from "../../components/ui/Button";
import { ImagePlaceholder } from "../../components/ui/ImagePlaceholder";
import { supabase } from "../../lib/supabase";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

// Dev-only shortcut so screens past the login gate can be browsed without a
// real SMS OTP round trip. Signs in as a real, seeded Supabase user (see
// packages/db/prisma/seed.ts — "Ama Owusu", a frequent-user persona with 7
// past delivered orders) via phone+password, so AuthProvider picks up a real
// session and every backend call behaves exactly as it would for a real user.
async function skipLoginForDev() {
  const { error } = await supabase.auth.signInWithPassword({
    phone: "+233241234567",
    password: "WaveDev123!",
  });
  if (error) {
    throw error;
  }
}

// Same idea, seeded as a "rider" role persona (Kofi Boateng — approved
// verification, 2 unclaimed orders sitting in the feed) so the rider flow
// can be browsed the same way. See packages/db/prisma/seed.ts.
async function skipLoginForDevAsRider() {
  const { error } = await supabase.auth.signInWithPassword({
    phone: "+233551234567",
    password: "WaveRider123!",
  });
  if (error) {
    throw error;
  }
}

// Same idea, seeded as a "shop_owner" role persona (Mama Put Kitchen) so the
// shop dashboard/menu flow can be browsed the same way.
async function skipLoginForDevAsShopOwner() {
  const { error } = await supabase.auth.signInWithPassword({
    phone: "+233201234567",
    password: "WaveShop123!",
  });
  if (error) {
    throw error;
  }
}

// v5 screen 02 — three panels behind one pager, driven by the dot rail up top.
const SLIDES = [
  {
    title: "Never miss\na run again",
    body: "We batch every off-campus order into one scheduled run — book pickup or ask us to buy for you before the cutoff.",
  },
  {
    title: "Tell us what\nyou need",
    body: "Describe the items and set a budget cap. Your runner buys them, keeps the receipt, and brings the change back.",
  },
  {
    title: "Collect at\nyour checkpoint",
    body: "Track the run live, then show your six-digit pickup code to the runner when they reach your hall.",
  },
];

export function WelcomeScreen({ navigation }: Props) {
  const [devError, setDevError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function handleContinue() {
    if (isLast) {
      navigation.navigate("PhoneEntry");
      return;
    }
    setIndex((i) => i + 1);
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="h-16" />

      <View className="mb-7 flex-row justify-center gap-2 px-7">
        {SLIDES.map((_, i) => (
          <View key={i} className={`h-2 rounded-full ${i === index ? "w-6 bg-wave-500" : "w-2 bg-border"}`} />
        ))}
      </View>

      <View className="flex-1 items-center justify-center px-7">
        <ImagePlaceholder height={290} radius={24} style={{ marginBottom: 32 }} />
        <Text className="mb-3.5 text-center font-sans-semibold text-[30px] leading-[34px] tracking-tighter text-ink">
          {slide.title}
        </Text>
        <Text className="max-w-[300px] text-center text-[16px] leading-6 text-muted">{slide.body}</Text>
      </View>

      <View className="gap-3 px-7 pb-11">
        <Button label={isLast ? "Continue" : "Next"} onPress={handleContinue} />
        {!isLast ? (
          <Text
            className="text-center font-sans-medium text-[13px] text-muted"
            onPress={() => navigation.navigate("PhoneEntry")}
          >
            Skip
          </Text>
        ) : null}
        {__DEV__ ? (
          <>
            <Text
              className="mt-1 text-center text-[12px] font-sans-medium text-muted"
              onPress={() => skipLoginForDev().catch((err) => setDevError(err.message))}
            >
              Skip login (dev) — student
            </Text>
            <Text
              className="text-center text-[12px] font-sans-medium text-muted"
              onPress={() => skipLoginForDevAsRider().catch((err) => setDevError(err.message))}
            >
              Skip login (dev) — rider
            </Text>
            <Text
              className="text-center text-[12px] font-sans-medium text-muted"
              onPress={() => skipLoginForDevAsShopOwner().catch((err) => setDevError(err.message))}
            >
              Skip login (dev) — shop owner
            </Text>
            {devError ? <Text className="text-center text-[11px] text-danger-text">{devError}</Text> : null}
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
