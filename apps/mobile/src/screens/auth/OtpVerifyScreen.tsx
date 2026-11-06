import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import {
  CodeInput,
  Gutter,
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../theme/tokens";

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

  const fromGuest = useAuthStore((st) => st.signingUpFromGuest);

  // The sixth digit submits (canvas board 24): there is no Confirm button to
  // reach for, and a pasted or auto-filled code goes through on its own.
  useEffect(() => {
    if (code.length === 6 && !loading) void handleConfirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleConfirm() {
    if (loading) return;
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
    // A guest who started at checkout is ordering as a student already.
    if (fromGuest) {
      navigation.replace("ProfileSetup", { role: "student" });
      return;
    }
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
      <TopBar onBack={() => navigation.replace("PhoneEntry")} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-4">
          <Text className="mb-2 font-sans-bold text-heading text-ink">Enter the code</Text>
          <Text className="mb-10 font-sans text-body text-muted">
            We sent six digits to <Text className="font-sans-medium text-ink">{phone}</Text>.
          </Text>

          <CodeInput
            value={code}
            onChangeText={setCode}
            state={error ? "error" : "default"}
            accessibilityLabel="6-digit sign-in code"
          />
          {error ? (
            <Text
              accessibilityLiveRegion="assertive"
              role="alert"
              className="mt-4 text-center font-sans text-body text-danger"
            >
              {error}
            </Text>
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

      {loading ? (
        <View className="items-center pb-8" accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.ink} />
          <Text className="mt-2 font-sans text-body text-muted">Checking the code</Text>
        </View>
      ) : null}
    </Screen>
  );
}
