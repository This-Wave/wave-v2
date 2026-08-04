import { Pressable, View } from "react-native";

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Blocks input while a change is in flight, so a double-tap cannot race itself. */
  disabled?: boolean;
}

export function ToggleSwitch({ value, onValueChange, disabled = false }: ToggleSwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={disabled ? { opacity: 0.5 } : undefined}
      className={`h-[26px] w-[44px] justify-center rounded-pill px-0.5 ${value ? "bg-wave-500" : "bg-border"}`}
    >
      <View className={`h-5 w-5 rounded-full bg-white ${value ? "ml-auto" : "ml-0"}`} />
    </Pressable>
  );
}
