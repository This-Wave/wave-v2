import { useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody, TopBar } from "../../components/v6";
import { PhoneField } from "../../components/ui/PhoneField";
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
    <Screen>
      <TopBar onBack={() => navigation.goBack()} />

      <ScreenBody bottomInset={16}>
        <Gutter className="pt-4">
          <Text className="mb-2 font-sans-bold text-heading text-ink">What's your number?</Text>
          <Text className="mb-10 font-sans text-body text-muted">
            We'll text you a six-digit code. No password to remember.
          </Text>

          <PhoneField value={localNumber} onChangeText={setLocalNumber} />
          {error ? <Text className="mt-3 font-sans text-body text-danger">{error}</Text> : null}
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <View className="gap-4">
          <Button
            label="Send my code"
            onPress={handleSendOtp}
            loading={loading}
            disabled={localNumber.length < 9}
          />
          <Text className="text-center font-sans text-meta text-muted">
            By continuing you agree to Wave's Terms and Privacy Policy.
          </Text>
        </View>
      </ActionBar>
    </Screen>
  );
}
