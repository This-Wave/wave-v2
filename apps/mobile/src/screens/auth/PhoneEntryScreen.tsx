import { useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { PhoneField } from "../../components/ui/PhoneField";
import { FieldLabel } from "../../components/ui/FieldLabel";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";

type Props = NativeStackScreenProps<AuthStackParamList, "PhoneEntry">;

/**
 * v5 screen 03. Same composition as the design — 110px of top air, a 28px
 * heading, one labelled field, the primary action, an "or" rule, then a
 * secondary route — but keyed to the phone-OTP flow Wave actually runs on
 * (Supabase Auth `signInWithOtp`) rather than the design's email placeholder.
 */
export function PhoneEntryScreen({ navigation }: Props) {
  const [localNumber, setLocalNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullPhone = `+233${localNumber.replace(/[^0-9]/g, "")}`;

  async function handleSendOtp() {
    setLoading(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    navigation.navigate("OtpVerify", { phone: fullPhone });
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="h-[110px]" />
      <View className="flex-1 px-7">
        <Text className="mb-2.5 font-sans-semibold text-[28px] tracking-tight text-ink">Sign in to Wave</Text>
        <Text className="mb-8 text-[14px] text-muted">
          Use your Ghana mobile number — we&apos;ll send a one-time code.
        </Text>

        <FieldLabel>Phone number</FieldLabel>
        <PhoneField value={localNumber} onChangeText={setLocalNumber} />
        {error ? <Text className="mt-2 text-[12px] text-danger-text">{error}</Text> : null}

        <View className="mt-5">
          <Button label="Send code" onPress={handleSendOtp} loading={loading} disabled={localNumber.length < 9} />
        </View>

        <View className="my-6 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-border" />
          <Text className="font-sans-medium text-[12px] text-muted">or</Text>
          <View className="h-px flex-1 bg-border" />
        </View>

        <Button label="Back to intro" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
      <Text className="px-7 pb-11 text-center text-[12px] text-muted">
        By continuing you agree to Wave&apos;s Terms &amp; Privacy Policy
      </Text>
    </SafeAreaView>
  );
}
