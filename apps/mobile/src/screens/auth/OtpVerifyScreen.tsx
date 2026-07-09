import { useEffect, useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { CodeInput } from "../../components/ui/CodeInput";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";

type Props = NativeStackScreenProps<AuthStackParamList, "OtpVerify">;

const RESEND_SECONDS = 60;

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
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-4">
        <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text className="mb-1.5 mt-7 font-sans-extrabold text-[22px] tracking-tight text-ink">Verify your number</Text>
        <Text className="mb-7 text-[13px] leading-5 text-muted">
          Code sent to <Text className="font-sans-bold text-ink">{phone}</Text>
        </Text>
        <CodeInput value={code} onChangeText={setCode} state={error ? "error" : "default"} />
        {error ? <Text className="mt-2 text-center text-[12px] text-danger-text">{error}</Text> : null}
        <View className="mb-auto mt-4 items-center">
          {secondsLeft > 0 ? (
            <Text className="text-[12px] text-muted">
              Resend code in{" "}
              <Text className="font-sans-bold text-ink">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </Text>
            </Text>
          ) : (
            <Text className="font-sans-semibold text-[12px] text-wave-500" onPress={handleResend}>
              Resend code
            </Text>
          )}
        </View>
        <View className="pb-6">
          <Button label="Confirm OTP" onPress={handleConfirm} loading={loading} disabled={code.length < 6} />
        </View>
      </View>
    </SafeAreaView>
  );
}
