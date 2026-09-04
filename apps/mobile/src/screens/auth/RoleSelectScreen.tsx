import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SelfServeProfileRole } from "@wave/shared";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";
import { ActionBar, Button, Gutter, Screen, ScreenBody } from "../../components/v6";
import { CheckIcon } from "../../components/icons";
import { colors } from "../../theme/tokens";

type Props = NativeStackScreenProps<AuthStackParamList, "RoleSelect">;

/**
 * The first thing a new account decides.
 *
 * Until this screen existed `ProfileSetupScreen` hardcoded `role: "student"`,
 * so every signup became a student and the only way to be a rider or a shop
 * owner was for an admin to change the row by hand. The API has accepted all
 * three self-serve roles the whole time (`SELF_SERVE_PROFILE_ROLES`), and
 * correctly refuses `admin`.
 *
 * Deliberately after the OTP rather than before it. The v6 redesign removed a
 * three-slide carousel from `WelcomeScreen` because it put taps between a
 * returning user and signing in; a role picker in front of the phone field
 * would reintroduce exactly that, and a returning user never sees this screen
 * at all — they already have a profile.
 */
const ROLES: Array<{
  role: SelfServeProfileRole;
  title: string;
  blurb: string;
  note?: string;
}> = [
  {
    role: "student",
    title: "Order things",
    blurb: "Ask for what you need from an off-campus shop and collect it at a checkpoint.",
  },
  {
    role: "rider",
    title: "Deliver orders",
    blurb: "Pick up students' orders and bring them to campus. You keep a share of each delivery fee.",
    note: "Needs ID verification before you can accept work.",
  },
  {
    role: "shop_owner",
    title: "Sell on Wave",
    blurb: "List your shop so students can order from it.",
    note: "Needs approval before students can see your shop.",
  },
];

export function RoleSelectScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<SelfServeProfileRole | null>(null);

  return (
    <Screen>
      <ScreenBody bottomInset={16}>
        <Gutter className="pt-12">
          <Text className="mb-2 font-sans-bold text-heading text-ink">How will you use Wave?</Text>
          <Text className="mb-10 font-sans text-body text-muted">
            You can only pick one — this decides what the app does for you.
          </Text>

          <View className="gap-2">
            {ROLES.map((option) => {
              const isSelected = selected === option.role;
              return (
                <Pressable
                  key={option.role}
                  onPress={() => setSelected(option.role)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={`flex-row items-start gap-3 rounded-card px-4 py-4 ${
                    isSelected ? "bg-lime-faint" : "bg-surface"
                  }`}
                >
                  <View className="flex-1">
                    <Text className="font-sans-medium text-ui text-ink">{option.title}</Text>
                    <Text className="mt-1 font-sans text-body text-muted">{option.blurb}</Text>
                    {option.note ? (
                      <Text className="mt-1.5 font-sans text-body text-muted">{option.note}</Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <View className="pt-0.5">
                      <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Gutter>
      </ScreenBody>

      <ActionBar>
        <Button
          label="Continue"
          disabled={!selected}
          onPress={() => selected && navigation.navigate("ProfileSetup", { role: selected })}
        />
      </ActionBar>
    </Screen>
  );
}
