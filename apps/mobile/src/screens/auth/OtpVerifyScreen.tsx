import { useEffect, useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { CodeInput } from "../../components/ui/CodeInput";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";

type Props = NativeStackScreenProps<AuthStackParamList, "OtpVerify">;

const RESEND_SECONDS = 60;

// Styled to match the v5 pickup-code screen (11): 44x58 cells on the canvas
// field, with a stack header instead of a bare back chip.
export function OtpVerifyScreen({ navigation, route }: Props) {
  const { phone } = route.params;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    setLoading(false);
    if (verifyError) {
      setError("Incorrect code. Please try again.");
      setCode("");
      return;
    }
    navigation.replace("ProfileSetup");
  }

  async function handleResend() {
    setSecondsLeft(RESEND_SECONDS);
    setCode("");
    await supabase.auth.signInWithOtp({ phone });
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Verify your number" onBack={() => navigation.goBack()} />
      <View className="flex-1 px-7 pt-8">
        <Text className="mb-7 text-center text-[14px] leading-[21px] text-muted">
          Code sent to <Text className="font-sans-semibold text-ink">{phone}</Text>
        </Text>
        <CodeInput value={code} onChangeText={setCode} state={error ? "error" : "default"} />
        {error ? <Text className="mt-3 text-center text-[12px] text-danger-text">{error}</Text> : null}
        <View className="mt-5 items-center">
          {secondsLeft > 0 ? (
            <Text className="text-[13px] text-muted">
              Resend code in{" "}
              <Text className="font-sans-semibold text-ink">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </Text>
            </Text>
          ) : (
            <Text className="font-sans-semibold text-[13px] text-wave-500" onPress={handleResend}>
              Resend code
            </Text>
          )}
        </View>
      </View>
      <View className="border-t border-border px-5 pb-11 pt-4">
        <Button label="Confirm code" onPress={handleConfirm} loading={loading} disabled={code.length < 6} />
      </View>
    </SafeAreaView>
  );
}
