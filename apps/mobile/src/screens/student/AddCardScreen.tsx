import { useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../../navigation/StudentNavigator";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";

function maskedNumber(digits: string): string {
  const last4 = digits.slice(-4);
  return `•••• •••• •••• ${last4.padEnd(4, "•")}`;
}

/**
 * v5 screen 16 "Add card". The green 146px card preview mirrors what's typed.
 *
 * Wave never vaults a PAN — Paystack's hosted checkout collects the full number
 * at charge time — so this form records the cardholder name and last four only,
 * which is what the app uses to label the method afterwards.
 */
export function AddCardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<StudentStackParamList>>();
  const [name, setName] = useState("");
  const [last4, setLast4] = useState("");
  const [expiry, setExpiry] = useState("");

  const canSave = name.trim().length > 1 && last4.length === 4 && expiry.length >= 4;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader title="Add card" onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-7 h-[146px] justify-between rounded-card bg-wave-500 p-[22px]">
          <View className="flex-row justify-between">
            <View className="h-5 w-[30px] rounded" style={{ backgroundColor: "rgba(176,232,146,0.2)" }} />
            <Text className="font-sans-semibold text-[13px] text-wave-lime">CARD</Text>
          </View>
          <Text className="font-sans-semibold text-[19px] tracking-[2px] text-white">{maskedNumber(last4)}</Text>
          <View className="flex-row justify-between">
            <Text className="text-[13px]" style={{ color: "rgba(255,255,255,0.8)" }}>
              {name.trim() || "Cardholder name"}
            </Text>
            <Text className="text-[13px]" style={{ color: "rgba(255,255,255,0.8)" }}>
              {expiry || "MM/YY"}
            </Text>
          </View>
        </View>

        <View className="mb-4">
          <TextField label="Cardholder name" value={name} onChangeText={setName} placeholder="Ama Mensah" />
        </View>

        <View className="mb-4">
          <TextField
            label="Last 4 digits"
            value={last4}
            onChangeText={(text) => setLast4(text.replace(/[^0-9]/g, "").slice(0, 4))}
            placeholder="4471"
            keyboardType="number-pad"
          />
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <TextField
              label="Expiry"
              value={expiry}
              onChangeText={(text) => {
                const digits = text.replace(/[^0-9]/g, "").slice(0, 4);
                setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
              }}
              placeholder="05/28"
              keyboardType="number-pad"
            />
          </View>
          <View className="flex-1">
            <TextField label="Issuer" value="Paystack" editable={false} onChangeText={() => {}} />
          </View>
        </View>

        <Text className="mt-4 text-center text-[12px] leading-[18px] text-muted">
          Wave stores the name and last four only. Paystack collects the full card number when you pay.
        </Text>
      </ScrollView>

      <View className="border-t border-border bg-canvas px-5 pb-11 pt-4">
        <Button label="Save card" disabled={!canSave} onPress={() => navigation.goBack()} />
      </View>
    </SafeAreaView>
  );
}
