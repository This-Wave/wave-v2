import { useState } from "react";
import { SafeAreaView, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { IconButton } from "../../components/ui/IconButton";
import { PhoneField } from "../../components/ui/PhoneField";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";

type Props = NativeStackScreenProps<AuthStackParamList, "PhoneEntry">;

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
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-4">
        <IconButton icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text className="mb-1.5 mt-7 font-sans-extrabold text-[22px] tracking-tight text-ink">Enter your number</Text>
        <Text className="mb-8 text-[13px] leading-5 text-muted">We&apos;ll send a one-time code to verify</Text>
        <PhoneField value={localNumber} onChangeText={setLocalNumber} />
        {error ? <Text className="mt-2 text-[12px] text-danger-text">{error}</Text> : null}
        <Text className="mb-6 mt-3.5 text-[11px] leading-5 text-muted">
          By continuing you agree to Wave&apos;s <Text className="font-sans-medium text-wave-500">Terms of Service</Text> and{" "}
          <Text className="font-sans-medium text-wave-500">Privacy Policy</Text>
        </Text>
        <View className="mt-auto pb-6">
          <Button label="Send OTP" onPress={handleSendOtp} loading={loading} disabled={localNumber.length < 9} />
        </View>
      </View>
    </SafeAreaView>
  );
}
