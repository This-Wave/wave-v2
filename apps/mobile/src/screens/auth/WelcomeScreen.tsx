import { SafeAreaView, Text, View } from "react-native";
import { Truck } from "lucide-react-native";
import { Button } from "../../components/ui/Button";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { useAuthStore } from "../../store/authStore";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

// Dev-only shortcut so screens past the login gate can be browsed without a
// real Supabase phone-OTP round trip. Backend calls made with this fake token
// will 401 — this is for eyeballing UI/navigation, not for testing API wiring.
function skipLoginForDev() {
  useAuthStore.getState().setSession("dev-fake-access-token", "dev-fake-refresh-token");
  useAuthStore.getState().setProfile({
    id: "dev-fake-user",
    universityId: "dev-fake-university",
    fullName: "Dev Tester",
    phone: "+233000000000",
    studentId: "DEV0000",
    role: "student",
    avatarUrl: null,
    pushToken: null,
    isActive: true,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function WelcomeScreen({ navigation }: Props) {
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
          <Text className="mt-1 text-center text-[12px] font-sans-medium text-muted" onPress={skipLoginForDev}>
            Skip login (dev)
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
