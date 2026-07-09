import { Pressable, View } from "react-native";

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleSwitch({ value, onValueChange }: ToggleSwitchProps) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      className={`h-[26px] w-[44px] justify-center rounded-pill px-0.5 ${value ? "bg-wave-500" : "bg-border"}`}
    >
      <View className={`h-5 w-5 rounded-full bg-white ${value ? "ml-auto" : "ml-0"}`} />
    </Pressable>
  );
}
