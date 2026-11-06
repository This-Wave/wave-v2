import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import {
  ActionBar,
  Button,
  Gutter,
  PhoneField,
  Screen,
  ScreenBody,
  TopBar,
} from "../../components/v6";
import { GHANA_LOCAL_PHONE_LENGTH, toGhanaE164 } from "@wave/shared";
import { supabase } from "../../lib/supabase";

type Props = NativeStackScreenProps<AuthStackParamList, "PhoneEntry">;

/**
 * Phone entry. Wave signs in by SMS one-time code — there is no password for a
 * student — so this is the whole of "sign up" and "sign in" at once, and the
 * copy avoids implying a choice between them.
 */
export function PhoneEntryScreen({ navigation }: Props) {
  const [localNumber, setLocalNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullPhone = toGhanaE164(localNumber);
  const fromGuest = useAuthStore((st) => st.signingUpFromGuest);
  const cancelSignupFromGuest = useAuthStore((st) => st.cancelSignupFromGuest);

  // Welcome *replaces* itself with this screen, so there is no history to go
  // back through: back used to do nothing. A guest goes back to their basket.
  function handleBack() {
    if (fromGuest) cancelSignupFromGuest();
    else if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace("Welcome");
  }

  async function handleSendOtp() {
    setLoading(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    navigation.replace("OtpVerify", { phone: fullPhone });
  }

  return (
    <Screen>
      <TopBar onBack={handleBack} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-4">
          <Text className="mb-2 font-sans-bold text-heading text-ink">What's your number?</Text>
          <Text className="mb-10 font-sans text-body text-muted">
            {fromGuest ? "Your basket is saved." : "We'll text you a six-digit code."}
          </Text>

          <PhoneField
            value={localNumber}
            onChangeText={setLocalNumber}
            label="Phone number"
            error={error}
          />
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-4">
          <Button
            label="Send my code"
            onPress={handleSendOtp}
            loading={loading}
            disabled={localNumber.length < GHANA_LOCAL_PHONE_LENGTH}
          />
          <Text className="text-center font-sans text-meta text-muted">
            By continuing you agree to Wave's Terms and Privacy Policy.
          </Text>
        </View>
      </ActionBar>
    </Screen>
  );
}
