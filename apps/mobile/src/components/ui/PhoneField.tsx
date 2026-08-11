import { Text, TextInput, View } from "react-native";
import { colors } from "../../theme/tokens";

interface PhoneFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

// Matches the v5 sign-in field (screen 03): one 52px well, the fixed prefix
// rendered as muted inline text rather than a separate country chip.
export function PhoneField({ value, onChangeText, placeholder = "54 321 0000" }: PhoneFieldProps) {
  return (
    <View className="h-[52px] flex-row items-center rounded-control border border-border bg-surface px-4">
      <Text className="font-sans-medium text-[15px] text-muted">+233 </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType="phone-pad"
        className="h-[52px] flex-1 font-sans-medium text-[15px] text-ink"
      />
    </View>
  );
}
