import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { CodeInput } from "../../components/ui/CodeInput";
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
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    setLoading(false);
    if (verifyError) {
      setError("That code didn't work. Check it and try again.");
      setCode("");
      return;
    }
    // A returning user never lands here with an unfinished profile — AuthProvider
    // has already put them in their role's navigator by now — so this path is
    // only ever a brand-new account, and it has to pick a role before there is
    // anything sensible to ask it for.
    navigation.replace("RoleSelect");
  }

  async function handleResend() {
    setSecondsLeft(RESEND_SECONDS);
    setCode("");
    await supabase.auth.signInWithOtp({ phone });
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-4">
          <Text className="mb-2 font-sans-bold text-heading text-ink">Check your texts</Text>
          <Text className="mb-10 font-sans text-body text-muted">
            We sent six digits to <Text className="font-sans-medium text-ink">{phone}</Text>.
          </Text>

          <CodeInput value={code} onChangeText={setCode} state={error ? "error" : "default"} />
          {error ? (
            <Text className="mt-4 text-center font-sans text-body text-danger">{error}</Text>
          ) : null}

          <View className="mt-6 items-center">
            {secondsLeft > 0 ? (
              <Text className="font-sans text-body text-muted">
                Didn't arrive? You can resend in {minutes}:{seconds.toString().padStart(2, "0")}
              </Text>
            ) : (
              <Text
                className="font-sans-medium text-body text-ink"
                accessibilityRole="button"
                onPress={handleResend}
              >
                Send it again
              </Text>
            )}
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Confirm"
          onPress={handleConfirm}
          loading={loading}
          disabled={code.length < 6}
        />
      </ActionBar>
    </Screen>
  );
}
