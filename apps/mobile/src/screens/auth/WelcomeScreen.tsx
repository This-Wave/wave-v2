import { useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import { Truck } from "lucide-react-native";
import { Button } from "../../components/ui/Button";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
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

export function WelcomeScreen({ navigation }: Props) {
  const [devError, setDevError] = useState<string | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-11 flex-row items-center gap-2.5">
          <Text className="font-sans-extrabold text-[28px] tracking-tight text-ink">wave</Text>
        </View>
        <View className="mb-9 h-[150px] w-[180px] items-center justify-center gap-2 rounded-card bg-surface-muted">
          <Truck size={52} color="#D0D0D0" strokeWidth={1.4} />
          <Text className="text-[11px] font-sans-medium text-faint">Campus Delivery</Text>
        </View>
        <Text className="mb-3 text-center font-sans-extrabold text-[26px] leading-8 tracking-tight text-ink">
          Campus deliveries,{"\n"}made simple.
        </Text>
        <Text className="mb-2 text-center text-[14px] leading-5 text-muted">
          Order from any shop in Accra · Pick up at a campus checkpoint
        </Text>
        <Text className="text-center text-[12px] font-sans-medium text-faint">Piloting at Ashesi University</Text>
      </View>
      <View className="gap-2.5 px-6 pb-6">
        <Button label="Get Started" onPress={() => navigation.navigate("PhoneEntry")} />
        <Button label="I already have an account" variant="secondary" onPress={() => navigation.navigate("PhoneEntry")} />
        {__DEV__ ? (
          <>
            <Text
              className="mt-1 text-center text-[12px] font-sans-medium text-muted"
              onPress={() => skipLoginForDev().catch((err) => setDevError(err.message))}
            >
              Skip login (dev)
            </Text>
            {devError ? <Text className="mt-1 text-center text-[11px] text-danger-text">{devError}</Text> : null}
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
