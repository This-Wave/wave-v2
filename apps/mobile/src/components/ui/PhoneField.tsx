import { Text, TextInput, View } from "react-native";
import { ChevronDown } from "lucide-react-native";

interface PhoneFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

export function PhoneField({ value, onChangeText, placeholder = "54 321 0000" }: PhoneFieldProps) {
  return (
    <View className="flex-row overflow-hidden rounded-control border-[1.5px] border-wave-500">
      <View className="flex-row items-center gap-1 border-r-[1.5px] border-border bg-surface-subtle px-3">
        <Text className="font-sans-bold text-[11px] tracking-wide text-text-secondary">GH</Text>
        <Text className="font-sans-semibold text-[13px] text-ink">+233</Text>
        <ChevronDown size={12} color="#9E9E9E" />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#BDBDBD"
        keyboardType="phone-pad"
        className="flex-1 px-3.5 py-[15px] text-[16px] font-sans-medium text-ink"
      />
    </View>
  );
}
